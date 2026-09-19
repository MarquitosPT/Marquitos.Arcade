using System.Text.Json;
using System.Text.Json.Nodes;
using MarquitosArcade.Data;
using MarquitosArcade.Web;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MarquitosArcade.Progress;

/// <param name="Stored">
/// <c>true</c> quando o progresso está guardado na conta. A visitantes responde
/// <c>false</c> — não é erro, é a forma de o jogo saber que só tem o aparelho
/// para se lembrar do que já fez.
/// </param>
/// <param name="Data">O JSON que o jogo guardou, ou <c>null</c> se ainda não há nada.</param>
public record ProgressDto(bool Stored, JsonNode? Data);

/// <summary>
/// Endpoint genérico de progresso: <c>GET/PUT /api/progress/:gameId</c>.
///
/// Serve para os jogos com níveis que se vão desbloqueando — quem tem sessão
/// iniciada recomeça em qualquer nível já aberto, em qualquer aparelho. O
/// conteúdo é opaco para o servidor (ver <see cref="GameProgressEntry"/>): o
/// cliente é o <c>wwwroot/lib/arcade/progress.js</c>, que junta o que está na
/// conta com o que está no aparelho.
/// </summary>
public static class ProgressEndpoints
{
    public static void MapProgressEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/progress");

        group.MapGet("/{gameId}", async (string gameId, ApplicationDbContext db, UserManager<ApplicationUser> userManager, HttpContext httpContext) =>
        {
            var cleanGameId = GameSlug.Sanitize(gameId);
            if (cleanGameId is null)
                return Results.BadRequest(new { error = "Jogo inválido" });

            var userId = await CurrentUserIdAsync(userManager, httpContext);
            if (userId is null)
                return Results.Ok(new ProgressDto(false, null));

            var entry = await db.GameProgress
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.UserId == userId && p.GameId == cleanGameId);

            return Results.Ok(new ProgressDto(true, ParseOrNull(entry?.Data)));
        });

        group.MapPut("/{gameId}", async (string gameId, JsonElement body, ApplicationDbContext db, UserManager<ApplicationUser> userManager, HttpContext httpContext) =>
        {
            var cleanGameId = GameSlug.Sanitize(gameId);
            if (cleanGameId is null)
                return Results.BadRequest(new { error = "Jogo inválido" });

            if (body.ValueKind != JsonValueKind.Object)
                return Results.BadRequest(new { error = "Progresso inválido" });

            var json = body.GetRawText();
            if (json.Length > GameProgressEntry.MaxDataLength)
                return Results.BadRequest(new { error = "Progresso demasiado grande" });

            var userId = await CurrentUserIdAsync(userManager, httpContext);
            // Sem sessão iniciada não há onde guardar, e isso não é um erro: o
            // jogo continua a jogar-se, com o progresso só neste aparelho.
            if (userId is null)
                return Results.Ok(new ProgressDto(false, null));

            var entry = await db.GameProgress
                .FirstOrDefaultAsync(p => p.UserId == userId && p.GameId == cleanGameId);

            if (entry is null)
            {
                db.GameProgress.Add(new GameProgressEntry
                {
                    GameId = cleanGameId,
                    UserId = userId,
                    Data = json,
                    UpdatedAtUtc = DateTime.UtcNow,
                });
            }
            else
            {
                entry.Data = json;
                entry.UpdatedAtUtc = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();
            return Results.Ok(new ProgressDto(true, ParseOrNull(json)));
        });
    }

    private static async Task<string?> CurrentUserIdAsync(UserManager<ApplicationUser> userManager, HttpContext httpContext)
    {
        if (httpContext.User.Identity?.IsAuthenticated != true)
            return null;

        var user = await userManager.GetUserAsync(httpContext.User);
        return user?.Id;
    }

    /// <summary>
    /// O JSON guardado, devolvido como objeto e não como texto — assim o jogo
    /// recebe a mesma forma que enviou, sem ter de desembrulhar uma string.
    /// Linhas antigas com JSON estragado valem tanto como não haver nada.
    /// </summary>
    private static JsonNode? ParseOrNull(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return null;

        try
        {
            return JsonNode.Parse(json);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
