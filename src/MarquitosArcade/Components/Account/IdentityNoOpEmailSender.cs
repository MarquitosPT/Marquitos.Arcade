using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.UI.Services;
using MarquitosArcade.Data;

namespace MarquitosArcade.Components.Account;

// Remove the "else if (EmailSender is IdentityNoOpEmailSender)" block from RegisterConfirmation.razor after updating with a real implementation.
internal sealed class IdentityNoOpEmailSender : IEmailSender<ApplicationUser>
{
    private readonly IEmailSender emailSender = new NoOpEmailSender();

    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink) =>
        emailSender.SendEmailAsync(email, "Confirma o teu email", $"Confirma a tua conta ao <a href='{confirmationLink}'>clicares aqui</a>.");

    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink) =>
        emailSender.SendEmailAsync(email, "Repõe a tua palavra-passe", $"Repõe a tua palavra-passe ao <a href='{resetLink}'>clicares aqui</a>.");

    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode) =>
        emailSender.SendEmailAsync(email, "Repõe a tua palavra-passe", $"Repõe a tua palavra-passe usando o seguinte código: {resetCode}");
}
