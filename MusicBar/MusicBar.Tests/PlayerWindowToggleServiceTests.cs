using MusicBar.Services;

namespace MusicBar.Tests;

public sealed class PlayerWindowToggleServiceTests
{
    [Theory]
    [InlineData("QB音乐", "qb")]
    [InlineData("QBMusic.exe", "qb")]
    [InlineData("com.laixingquan.musicdownloader", "qb")]
    [InlineData("musicdownloader", "qb")]
    public void GetPlayerIdMapsMediaSource(string sourceAppId, string expected)
    {
        Assert.Equal(expected, PlayerWindowToggleService.GetPlayerId(sourceAppId));
    }

    [Fact]
    public void GetProcessNamesIncludesQbMusicProcess()
    {
        var names = PlayerWindowToggleService.GetProcessNames("QB音乐");

        Assert.Contains("QB音乐", names);
    }

    [Fact]
    public void UnknownMediaSourceDoesNotTargetAnUnrelatedWindow()
    {
        Assert.Null(PlayerWindowToggleService.GetPlayerId("unknown.player"));
        Assert.Empty(PlayerWindowToggleService.GetProcessNames("unknown.player"));
    }
}
