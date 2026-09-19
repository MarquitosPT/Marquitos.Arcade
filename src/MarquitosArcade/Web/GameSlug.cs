using System.Text.RegularExpressions;

namespace MarquitosArcade.Web;

/// <summary>
/// O slug do jogo que vem no URL (<c>/api/scores/:gameId</c>,
/// <c>/api/progress/:gameId</c>). É escrito pelo cliente, por isso passa por
/// aqui antes de ir para a base de dados — vive num sítio só para os dois
/// endpoints não divergirem no que aceitam.
/// </summary>
public static partial class GameSlug
{
    private const int MaxLength = 40;

    /// <summary>
    /// Devolve o slug limpo (só letras, dígitos e hífenes) ou <c>null</c> se não
    /// sobrar nada — e aí o pedido é um 400.
    /// </summary>
    public static string? Sanitize(string? gameId)
    {
        if (gameId is null)
            return null;

        var cleaned = DisallowedPattern().Replace(gameId, "");
        cleaned = cleaned.Length > MaxLength ? cleaned[..MaxLength] : cleaned;
        return cleaned.Length == 0 ? null : cleaned;
    }

    [GeneratedRegex("[^a-z0-9-]", RegexOptions.IgnoreCase)]
    private static partial Regex DisallowedPattern();
}
