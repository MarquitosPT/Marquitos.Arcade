using System.Reflection;

namespace MarquitosArcade.Components;

/// <summary>Um jogo do catálogo da arcada.</summary>
/// <param name="Slug">Pasta do jogo em <c>wwwroot/games/</c> e id usado nas pontuações.</param>
/// <param name="Theme">Classe CSS com a cor e o lettering do jogo.</param>
/// <param name="Cover">Capa 16:9 gerada por <c>tools/covers/</c>.</param>
/// <param name="Version">Versão do jogo — a mesma do <c>ABOUT</c> no <c>js/config.js</c> dele.</param>
/// <param name="Published">Data de publicação — a mesma do <c>ABOUT</c> no <c>js/config.js</c> dele.</param>
/// <param name="Badge">Etiqueta opcional no canto da capa (ex.: "Novo").</param>
/// <param name="IsPlayable">Jogos por lançar não têm link e levam o carimbo "Em breve".</param>
public sealed record ArcadeGame(
    string Slug,
    string Title,
    string Tagline,
    string Description,
    string Emoji,
    string Theme,
    string Cover,
    string Version,
    DateOnly Published,
    string? Badge = null,
    bool IsPlayable = true,
    string PlayLabel = "Jogar")
{
    public string PlayUrl => $"/games/{Slug}/";
}

/// <summary>
/// O catálogo e a ficha da própria arcada. Vive fora das páginas porque há duas a
/// lê-lo: a home (os cartões) e o <c>/acerca</c> (a lista de jogos).
/// </summary>
public static class ArcadeCatalog
{
    public const string Title = "Marquitos Arcade";
    public const string Author = "Marcos Gomes (MarquitosPT)";
    public const string CopyrightHolder = "MarquitosPT";

    /// <summary>Dia em que a arcada abriu.</summary>
    public static readonly DateOnly Published = new(2026, 9, 6);

    /// <summary>
    /// A versão do site é a do assembly (<c>&lt;Version&gt;</c> no .csproj). O SDK
    /// acrescenta-lhe o commit depois de um "+" (ex. <c>1.0.0+02f2571…</c>), que
    /// aqui não interessa a ninguém.
    /// </summary>
    public static readonly string Version =
        (typeof(ArcadeCatalog).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? "1.0.0").Split('+')[0];

    // Mais recentes primeiro: um jogo novo entra no topo do array e os mais
    // antigos vão descendo para o fim do catálogo.
    public static readonly ArcadeGame[] Games =
    [
        new("terras-do-reino",
            "Terras do Reino",
            "campos • minas • mercados",
            "Semeia, colhe, abre minas e oficinas e faz do teu o reino mais próspero, sem guerras.",
            "🏰",
            "theme-reino",
            "/covers/terras-do-reino.webp",
            "1.0.0",
            new(2026, 9, 26),
            Badge: "Novo"),

        new("maze-run",
            "Maze Run",
            "labirintos & fugas",
            "Foge aos guardas por labirintos com portais e portas trancadas, e desbloqueia o nível seguinte.",
            "🧩",
            "theme-maze",
            "/covers/maze-run.webp",
            "1.0.0",
            new(2026, 9, 19),
            Badge: "Novo"),

        new("pixel-racing",
            "Pixel Racing",
            "boost • drift • torneios",
            "Corridas arcade em pistas curtas, com boost, drift e torneios. Tu e três adversários CPU.",
            "🏎️",
            "theme-racing",
            "/covers/pixel-racing.webp",
            "1.0.0",
            new(2026, 9, 12),
            Badge: "Novo"),

        new("pong",
            "Pong Retro",
            "retro • arcade",
            "Releitura neon do clássico Pong, com modo 1 jogador (vs. CPU) ou 2 jogadores no mesmo ecrã.",
            "🏓",
            "theme-pong",
            "/covers/pong.webp",
            "1.0.0",
            new(2026, 9, 6)),

        new("tasca-do-ze",
            "Tasca do Zé",
            "o teu turno na cozinha",
            "Gere os pedidos, prepara os pratos certos e serve os clientes antes que percam a paciência.",
            "🍽️",
            "theme-tasca",
            "/covers/tasca-do-ze.webp",
            "1.0.0",
            new(2026, 9, 6))
    ];
}
