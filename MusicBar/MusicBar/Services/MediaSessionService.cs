using MusicBar.Models;
using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Windows.Media.Control;
using Windows.Storage.Streams;

namespace MusicBar.Services;

public sealed class MediaSessionService : IDisposable
{
    private static readonly TimeSpan SessionLossGracePeriod = TimeSpan.FromSeconds(4);
    private readonly SemaphoreSlim _refreshGate = new(1, 1);
    private readonly MediaPositionTracker _positionTracker = new();
    private GlobalSystemMediaTransportControlsSessionManager? _manager;
    private GlobalSystemMediaTransportControlsSession? _session;
    private Timer? _refreshTimer;
    private DateTimeOffset? _sessionMissingSince;
    private bool _disposed;

    public event EventHandler<MediaSnapshot>? SnapshotChanged;

    public MediaSnapshot Current { get; private set; } = MediaSnapshot.Empty;

    public async Task InitializeAsync()
    {
        _manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
        _manager.CurrentSessionChanged += OnManagerSessionChanged;
        _manager.SessionsChanged += OnManagerSessionChanged;
        AttachBestSession(DateTimeOffset.Now);
        await RefreshAsync();
        _refreshTimer = new Timer(async _ => await RefreshAsync(), null, 750, 750);
    }

    public async Task TogglePlayPauseAsync()
    {
        if (_session is null)
        {
            return;
        }

        if (Current.IsPlaying && Current.CanPause)
        {
            await _session.TryPauseAsync();
        }
        else if (Current.CanPlay)
        {
            await _session.TryPlayAsync();
        }
        else
        {
            await _session.TryTogglePlayPauseAsync();
        }

        await RefreshAsync();
    }

    public async Task PreviousAsync()
    {
        if (_session is not null)
        {
            await _session.TrySkipPreviousAsync();
        }
    }

    public async Task NextAsync()
    {
        if (_session is not null)
        {
            await _session.TrySkipNextAsync();
        }
    }

    /// <summary>
    /// 相对快进/快退：在当前进度上增减一个时间增量（如 ±15 秒），并夹取到 [0, 总时长]。
    /// </summary>
    public async Task SeekByAsync(TimeSpan delta)
    {
        if (_session is null || Current.Duration <= TimeSpan.Zero)
        {
            return;
        }

        var target = Current.Position + delta;
        if (target < TimeSpan.Zero)
        {
            target = TimeSpan.Zero;
        }
        if (target > Current.Duration)
        {
            target = Current.Duration;
        }
        await SeekToAsync(target);
    }

    /// <summary>
    /// 直接跳转到指定播放位置（通过系统媒体会话的 TryChangePlaybackPositionAsync）。
    /// </summary>
    public async Task SeekToAsync(TimeSpan position)
    {
        if (_session is null || position < TimeSpan.Zero)
        {
            return;
        }

        await _session.TryChangePlaybackPositionAsync(position.Ticks);
        await RefreshAsync();
    }

    public void CalibratePosition(TimeSpan actualPosition) =>
        _positionTracker.Calibrate(actualPosition, DateTimeOffset.Now);

    private void OnManagerSessionChanged(
        GlobalSystemMediaTransportControlsSessionManager sender,
        object args) => _ = RefreshAsync();

    private void AttachBestSession(DateTimeOffset now)
    {
        if (_manager is null)
        {
            return;
        }

        var current = _manager.GetCurrentSession();
        var sessions = _manager.GetSessions()
            .Where(candidate => IsSupportedMusicSource(candidate.SourceAppUserModelId))
            .ToList();
        var next = SelectBestSupportedSession(sessions, current, _session);

        if (next is null)
        {
            _sessionMissingSince ??= now;
            if (_session is not null &&
                (IsKnownPlayerProcessRunning(_session.SourceAppUserModelId) ||
                 !IsSessionLossGraceExpired(_sessionMissingSince, now)))
            {
                return;
            }

            DetachSession();
            return;
        }

        _sessionMissingSince = null;

        if (ReferenceEquals(next, _session))
        {
            return;
        }

        DetachSession();
        _session = next;
        if (_session is not null)
        {
            _session.MediaPropertiesChanged += OnSessionStateChanged;
            _session.PlaybackInfoChanged += OnSessionStateChanged;
            _session.TimelinePropertiesChanged += OnSessionStateChanged;
        }
    }

    private void OnSessionStateChanged(
        GlobalSystemMediaTransportControlsSession sender,
        object args) => _ = RefreshAsync();

    private async Task RefreshAsync()
    {
        if (_disposed || !await _refreshGate.WaitAsync(0))
        {
            return;
        }

        try
        {
            AttachBestSession(DateTimeOffset.Now);
            var session = _session;
            if (session is null)
            {
                if (Current.HasSession)
                {
                    Publish(MediaSnapshot.Empty);
                }
                return;
            }

            var media = await session.TryGetMediaPropertiesAsync();
            var playback = session.GetPlaybackInfo();
            var timeline = session.GetTimelineProperties();
            var controls = playback.Controls;
            var artwork = await ReadArtworkAsync(media.Thumbnail);
            var isPlaying = playback.PlaybackStatus ==
                GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
            var duration = timeline.EndTime > timeline.StartTime
                ? timeline.EndTime - timeline.StartTime
                : TimeSpan.Zero;
            var position = _positionTracker.Update(
                $"{media.Title}\u001f{media.Artist}",
                timeline.Position,
                timeline.LastUpdatedTime,
                timeline.StartTime,
                timeline.EndTime,
                isPlaying,
                playback.PlaybackRate ?? 1,
                DateTimeOffset.Now);
            Publish(new MediaSnapshot(
                true,
                string.IsNullOrWhiteSpace(media.Title) ? "未知歌曲" : media.Title,
                string.IsNullOrWhiteSpace(media.Artist) ? "未知歌手" : media.Artist,
                media.AlbumTitle ?? string.Empty,
                session.SourceAppUserModelId ?? string.Empty,
                artwork,
                isPlaying,
                controls.IsPlayEnabled || controls.IsPlayPauseToggleEnabled,
                controls.IsPauseEnabled || controls.IsPlayPauseToggleEnabled,
                controls.IsPreviousEnabled,
                controls.IsNextEnabled,
                position,
                duration));
        }
        catch
        {
            // A player can replace its media session while starting. Keep the last good snapshot;
            // the next serialized timer pass will attach the replacement session.
        }
        finally
        {
            _refreshGate.Release();
        }
    }

    internal static TimeSpan EstimatePosition(
        TimeSpan reportedPosition,
        DateTimeOffset lastUpdated,
        TimeSpan startTime,
        TimeSpan endTime,
        bool isPlaying,
        double playbackRate,
        DateTimeOffset now)
    {
        var position = reportedPosition;
        var elapsed = now - lastUpdated;
        if (isPlaying && playbackRate > 0 && elapsed > TimeSpan.Zero && elapsed < TimeSpan.FromHours(1))
        {
            position += TimeSpan.FromTicks((long)(elapsed.Ticks * playbackRate));
        }

        if (position < startTime)
        {
            return startTime;
        }
        if (endTime > startTime && position > endTime)
        {
            return endTime;
        }
        return position;
    }

    internal static bool IsSessionLossGraceExpired(
        DateTimeOffset? missingSince,
        DateTimeOffset now) =>
        missingSince is not null && now - missingSince.Value >= SessionLossGracePeriod;

    internal static string? GetKnownPlayerProcessName(string? sourceAppId)
    {
        var source = sourceAppId?.ToLowerInvariant() ?? string.Empty;
        // QB音乐（Electron）通过 navigator.mediaSession 暴露系统媒体会话，
        // SourceAppUserModelId 为 main.js 中 setAppUserModelId 设置的值或可执行文件名。
        if (source.Contains("qb音乐") || source.Contains("qbmusic") ||
            source.Contains("com.laixingquan") || source.Contains("musicdownloader") ||
            source.Contains("laixinquan")) return "QB音乐";
        return null;
    }

    internal static bool IsSupportedMusicSource(string? sourceAppId) =>
        GetKnownPlayerProcessName(sourceAppId) is not null;

    private static GlobalSystemMediaTransportControlsSession? SelectBestSupportedSession(
        IReadOnlyList<GlobalSystemMediaTransportControlsSession> sessions,
        GlobalSystemMediaTransportControlsSession? current,
        GlobalSystemMediaTransportControlsSession? attached)
    {
        var currentCandidate = FindMatchingSession(sessions, current);
        if (currentCandidate is not null &&
            currentCandidate.GetPlaybackInfo().PlaybackStatus ==
                GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
        {
            return currentCandidate;
        }

        var playing = sessions.FirstOrDefault(candidate =>
            candidate.GetPlaybackInfo().PlaybackStatus ==
                GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing);
        if (playing is not null)
        {
            return playing;
        }

        var attachedCandidate = FindMatchingSession(sessions, attached);
        if (attachedCandidate is not null)
        {
            return attachedCandidate;
        }

        return currentCandidate ?? sessions.FirstOrDefault();
    }

    private static GlobalSystemMediaTransportControlsSession? FindMatchingSession(
        IReadOnlyList<GlobalSystemMediaTransportControlsSession> sessions,
        GlobalSystemMediaTransportControlsSession? target) =>
        target is null
            ? null
            : sessions.FirstOrDefault(candidate =>
                string.Equals(candidate.SourceAppUserModelId, target.SourceAppUserModelId,
                    StringComparison.OrdinalIgnoreCase));

    private static bool IsKnownPlayerProcessRunning(string? sourceAppId)
    {
        var processName = GetKnownPlayerProcessName(sourceAppId);
        if (processName is null)
        {
            return false;
        }

        try
        {
            var processes = System.Diagnostics.Process.GetProcessesByName(processName);
            foreach (var process in processes)
            {
                process.Dispose();
            }
            return processes.Length > 0;
        }
        catch
        {
            return false;
        }
    }

    private void Publish(MediaSnapshot snapshot)
    {
        Current = snapshot;
        SnapshotChanged?.Invoke(this, snapshot);
    }

    private static async Task<ImageSource?> ReadArtworkAsync(Windows.Storage.Streams.IRandomAccessStreamReference? reference)
    {
        if (reference is null)
        {
            return null;
        }

        try
        {
            using var randomAccessStream = await reference.OpenReadAsync();
            var length = checked((uint)randomAccessStream.Size);
            using var reader = new DataReader(randomAccessStream.GetInputStreamAt(0));
            await reader.LoadAsync(length);
            var bytes = new byte[length];
            reader.ReadBytes(bytes);
            using var memory = new MemoryStream(bytes, writable: false);

            var bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.StreamSource = memory;
            bitmap.EndInit();
            bitmap.Freeze();
            return bitmap;
        }
        catch
        {
            return null;
        }
    }

    private void DetachSession()
    {
        if (_session is null)
        {
            return;
        }

        _session.MediaPropertiesChanged -= OnSessionStateChanged;
        _session.PlaybackInfoChanged -= OnSessionStateChanged;
        _session.TimelinePropertiesChanged -= OnSessionStateChanged;
        _positionTracker.Reset();
        _session = null;
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _refreshTimer?.Dispose();
        DetachSession();
        if (_manager is not null)
        {
            _manager.CurrentSessionChanged -= OnManagerSessionChanged;
            _manager.SessionsChanged -= OnManagerSessionChanged;
        }
        _refreshGate.Dispose();
    }
}
