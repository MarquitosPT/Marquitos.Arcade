namespace MarquitosArcade.Data;

/// <summary>
/// O progresso de um jogador num jogo — os níveis que já desbloqueou, as marcas
/// que fez em cada um. Uma linha por (conta, jogo).
///
/// O servidor não sabe o que está lá dentro: <see cref="Data"/> é o mesmo JSON
/// que o jogo guarda no aparelho de quem joga sem conta (ver
/// <c>wwwroot/lib/arcade/progress.js</c>). É de propósito — assim um jogo novo
/// que queira guardar progresso não obriga a mexer no servidor nem a criar uma
/// migration, tal como acontece com as pontuações.
/// </summary>
public class GameProgressEntry
{
    /// <summary>
    /// Teto do JSON guardado, em caracteres. Um jogo guarda aqui uma dúzia de
    /// números por nível; isto dá folga de sobra e evita que a tabela se torne
    /// um sítio para despejar o que calhar. É o mesmo número no limite da coluna
    /// e na validação do endpoint.
    /// </summary>
    public const int MaxDataLength = 8 * 1024;

    public int Id { get; set; }

    /// <summary>Slug do jogo, igual ao da pasta em <c>wwwroot/games/</c>.</summary>
    public required string GameId { get; set; }

    /// <summary>Conta a que o progresso pertence. Visitantes não chegam aqui.</summary>
    public required string UserId { get; set; }

    /// <summary>Estado do jogo em JSON, tal como o jogo o escreveu.</summary>
    public required string Data { get; set; }

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
