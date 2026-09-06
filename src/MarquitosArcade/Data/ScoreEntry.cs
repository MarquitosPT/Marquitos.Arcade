namespace MarquitosArcade.Data;

public class ScoreEntry
{
    public int Id { get; set; }
    public required string GameId { get; set; }
    public required string PlayerName { get; set; }
    public string? UserId { get; set; }
    public int Score { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
