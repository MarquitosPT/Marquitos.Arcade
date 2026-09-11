using System.Text.RegularExpressions;
using MarquitosArcade.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MarquitosArcade.Scores;

public record ScoreSubmission(string? Name, int Score);

public record ScoreDto(string Name, int Score, long Ts);

public static class ScoresEndpoints
{
    private const int TopCount = 20;
    private static readonly Regex GameIdPattern = new("[^a-z0-9-]", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static void MapScoresEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/scores");

        group.MapGet("/{gameId}", async (string gameId, ApplicationDbContext db) =>
        {
            var cleanGameId = SanitizeGameId(gameId);
            if (cleanGameId is null)
                return Results.BadRequest(new { error = "Jogo inválido" });

            var scores = await GetTopScoresAsync(db, cleanGameId);
            return Results.Ok(scores);
        });

        group.MapPost("/{gameId}", async (string gameId, ScoreSubmission submission, ApplicationDbContext db, UserManager<ApplicationUser> userManager, HttpContext httpContext) =>
        {
            var cleanGameId = SanitizeGameId(gameId);
            if (cleanGameId is null)
                return Results.BadRequest(new { error = "Jogo inválido" });

            if (submission.Score < 0 || submission.Score > 999999)
                return Results.BadRequest(new { error = "Pontuação inválida" });

            string? userId = null;
            if (httpContext.User.Identity?.IsAuthenticated == true)
            {
                var user = await userManager.GetUserAsync(httpContext.User);
                userId = user?.Id;
            }

            var playerName = SanitizeName(submission.Name);

            db.Scores.Add(new ScoreEntry
            {
                GameId = cleanGameId,
                PlayerName = playerName,
                UserId = userId,
                Score = submission.Score,
                CreatedAtUtc = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();

            var topScores = await GetTopScoresAsync(db, cleanGameId);
            return Results.Ok(topScores);
        });
    }

    public static Task<List<ScoreDto>> GetTopScoresAsync(ApplicationDbContext db, string gameId) =>
        db.Scores
            .Where(s => s.GameId == gameId)
            .OrderByDescending(s => s.Score)
            .ThenBy(s => s.CreatedAtUtc)
            .Take(TopCount)
            .Select(s => new ScoreDto(s.PlayerName, s.Score, ToUnixMillis(s.CreatedAtUtc)))
            .ToListAsync();

    private static string? SanitizeGameId(string gameId)
    {
        var cleaned = GameIdPattern.Replace(gameId, "");
        cleaned = cleaned.Length > 40 ? cleaned[..40] : cleaned;
        return cleaned.Length == 0 ? null : cleaned;
    }

    private static string SanitizeName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return "Anónimo";

        var clean = Regex.Replace(name, "<[^>]*>", "").Trim();
        clean = clean.Length > 24 ? clean[..24] : clean;
        return clean.Length == 0 ? "Anónimo" : clean;
    }

    private static long ToUnixMillis(DateTime utc) =>
        new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeMilliseconds();
}
