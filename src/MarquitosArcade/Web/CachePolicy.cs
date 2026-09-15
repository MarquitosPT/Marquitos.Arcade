using Microsoft.Net.Http.Headers;

namespace MarquitosArcade.Web;

/// <summary>
/// Política de cache HTTP do site. Só há dois regimes:
///
/// <list type="bullet">
///   <item>
///     URLs com impressão digital no conteúdo (o <c>?v=</c> que o
///     <c>@Assets[...]</c> do Blazor acrescenta) podem ficar em cache para
///     sempre — se o ficheiro mudar, muda o URL.
///   </item>
///   <item>
///     Todo o resto — o HTML das páginas, o <c>index.html</c> de cada jogo, o
///     CSS e os módulos JS dentro de <c>games/</c>, as capas, o
///     <c>site.webmanifest</c> — leva <c>no-cache</c>: o browser guarda a cópia
///     mas é obrigado a perguntar ao servidor se ainda serve antes de a usar.
///     Com o <c>ETag</c> que o servidor de ficheiros estáticos já emite, essa
///     pergunta custa um 304 vazio quando nada mudou.
///   </item>
/// </list>
///
/// Sem isto, o <c>UseStaticFiles</c> responde sem <c>Cache-Control</c> nenhum e
/// o browser fica livre para inventar um prazo de validade (a heurística do
/// RFC 9111: uma fração da idade do ficheiro). Numa PWA afixada ao ecrã
/// principal — que arranca sempre no mesmo <c>start_url</c> e nunca vê um
/// Ctrl+F5 — isso traduz-se em jogos a correr com scripts de há dias.
/// </summary>
public static class CachePolicy
{
    /// <summary>Parâmetro de versão dos URLs com impressão digital (<c>styles.css?v=abc123</c>).</summary>
    private const string FingerprintParameter = "v";

    private const string Forever = "public, max-age=31536000, immutable";

    private const string Revalidate = "no-cache";

    /// <summary>
    /// Carimba a política de cache em todas as respostas. Tem de ser registado
    /// antes do <c>UseStaticFiles</c>/<c>MapStaticAssets</c>, mas quem escreve
    /// o cabeçalho é o <c>OnStarting</c> — que corre já depois de esses terem
    /// posto os deles, e por isso ganha.
    /// </summary>
    public static IApplicationBuilder UseArcadeCachePolicy(this IApplicationBuilder app)
    {
        // Os tipos dos parâmetros vão escritos por causa das duas sobrecargas do
        // `Use` (a antiga com `Func<Task>` e a atual com `RequestDelegate`).
        return app.Use(static (HttpContext context, RequestDelegate next) =>
        {
            context.Response.OnStarting(static state =>
            {
                Apply((HttpContext)state);
                return Task.CompletedTask;
            }, context);

            return next(context);
        });
    }

    private static void Apply(HttpContext context)
    {
        var response = context.Response;

        // O handshake do websocket do Blazor (101) não é um recurso — não há
        // nada para guardar em cache nem para revalidar.
        if (response.StatusCode == StatusCodes.Status101SwitchingProtocols)
            return;

        // O Identity marca as páginas de conta como `no-store` (nada de deixar
        // rasto de uma sessão no disco de quem visita). Isso é mais restritivo
        // do que o `no-cache` daqui, por isso não se mexe.
        if (response.Headers.CacheControl.ToString().Contains("no-store", StringComparison.OrdinalIgnoreCase))
            return;

        var fingerprinted = context.Request.Query.ContainsKey(FingerprintParameter)
            && response.StatusCode is StatusCodes.Status200OK or StatusCodes.Status304NotModified;

        response.Headers.CacheControl = fingerprinted ? Forever : Revalidate;

        // Um `Expires` antigo no futuro não anula o `Cache-Control` em HTTP/1.1,
        // mas há caches que ainda olham para ele. Fora daqui.
        response.Headers.Remove(HeaderNames.Expires);
    }
}
