using MusicBar.Models;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MusicBar.Services.Lyrics;

/// <summary>
/// 从 QB音乐 本地服务获取实时歌词的提供器。
/// 通过本地 HTTP API（默认 http://localhost:3000）先搜索歌曲拿到 id，
/// 再拉取歌曲详情中的 LRC 歌词，避免依赖外部歌词服务导致超时。
/// </summary>
public sealed class QbMusicLyricsProvider : ILyricsProvider
{
    private const string DefaultBaseUrl = "http://localhost:3000";
    private readonly HttpClient _client;
    private readonly LrcLyricsService _parser = new();
    private readonly string _baseUrl;

    public string Name => "QB音乐";
    public int Priority => 100;

    /// <summary>
    /// 构造 QB音乐 歌词提供器。
    /// </summary>
    /// <param name="baseUrl">QB音乐 本地服务地址（不含末尾斜杠）</param>
    public QbMusicLyricsProvider(string baseUrl = DefaultBaseUrl)
    {
        _baseUrl = baseUrl.TrimEnd('/');
        // 本地服务响应快，超时不宜过长，避免歌词长期停留在"寻找中"
        _client = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
    }

    /// <summary>
    /// 仅当同时具备歌名与歌手时才可尝试匹配歌词。
    /// </summary>
    public bool CanHandle(LyricsTrack track) =>
        !string.IsNullOrWhiteSpace(track.Title) &&
        !string.IsNullOrWhiteSpace(track.Artist);

    /// <summary>
    /// 通过 QB音乐 本地 API 获取 LRC 歌词。
    /// </summary>
    public async Task<LyricsDocument?> GetLyricsAsync(
        LyricsTrack track,
        CancellationToken cancellationToken)
    {
        var songId = await ResolveSongIdAsync(track, cancellationToken);
        if (string.IsNullOrWhiteSpace(songId))
        {
            return null;
        }

        try
        {
            var detailUrl = $"{_baseUrl}/api/music/{Uri.EscapeDataString(songId)}";
            var detailJson = await _client.GetStringAsync(detailUrl, cancellationToken);
            var detail = JsonSerializer.Deserialize<MusicDetailResponse>(detailJson);
            var lyrics = detail?.Data?.Lyrics;
            if (string.IsNullOrWhiteSpace(lyrics))
            {
                return null;
            }

            // 解析 LRC 文本为歌词文档（置信度取 1，本地源视为精确匹配）
            return _parser.ParseText(lyrics, "QB音乐", LyricsSourceKind.Online, 1);
        }
        catch (Exception exception) when (
            !cancellationToken.IsCancellationRequested &&
            exception is HttpRequestException or TaskCanceledException or JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// 用歌名+歌手搜索 QB音乐 聚合源，返回首个歌曲 id。
    /// </summary>
    private async Task<string?> ResolveSongIdAsync(
        LyricsTrack track,
        CancellationToken cancellationToken)
    {
        try
        {
            var keyword = $"{track.Title} {track.Artist}".Trim();
            var searchUrl = $"{_baseUrl}/api/search?keyword={Uri.EscapeDataString(keyword)}&source=all";
            var searchJson = await _client.GetStringAsync(searchUrl, cancellationToken);
            var search = JsonSerializer.Deserialize<SearchResponse>(searchJson);
            return search?.Data?.FirstOrDefault(song => !string.IsNullOrWhiteSpace(song.Id))?.Id;
        }
        catch (Exception exception) when (
            !cancellationToken.IsCancellationRequested &&
            exception is HttpRequestException or TaskCanceledException or JsonException)
        {
            return null;
        }
    }

    private sealed class SearchResponse
    {
        [JsonPropertyName("data")] public List<SearchItem>? Data { get; set; }
    }

    private sealed class SearchItem
    {
        [JsonPropertyName("id")] public string? Id { get; set; }
    }

    private sealed class MusicDetailResponse
    {
        [JsonPropertyName("data")] public MusicDetailData? Data { get; set; }
    }

    private sealed class MusicDetailData
    {
        [JsonPropertyName("lyrics")] public string? Lyrics { get; set; }
    }
}
