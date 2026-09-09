using Microsoft.AspNetCore.Identity;

namespace MarquitosArcade.Components.Account;

/// <summary>
/// Traduz para português (PT) as mensagens de erro predefinidas do ASP.NET Core Identity,
/// que só existem em inglês (e em português do Brasil) nos pacotes da Microsoft.
/// </summary>
internal sealed class PortugueseIdentityErrorDescriber : IdentityErrorDescriber
{
    public override IdentityError DefaultError() => new()
    {
        Code = nameof(DefaultError),
        Description = "Ocorreu uma falha desconhecida.",
    };

    public override IdentityError ConcurrencyFailure() => new()
    {
        Code = nameof(ConcurrencyFailure),
        Description = "Falha de concorrência: o objeto foi modificado por outro processo.",
    };

    public override IdentityError PasswordMismatch() => new()
    {
        Code = nameof(PasswordMismatch),
        Description = "Palavra-passe incorreta.",
    };

    public override IdentityError InvalidToken() => new()
    {
        Code = nameof(InvalidToken),
        Description = "Token inválido.",
    };

    public override IdentityError RecoveryCodeRedemptionFailed() => new()
    {
        Code = nameof(RecoveryCodeRedemptionFailed),
        Description = "Não foi possível validar o código de recuperação.",
    };

    public override IdentityError LoginAlreadyAssociated() => new()
    {
        Code = nameof(LoginAlreadyAssociated),
        Description = "Já existe um utilizador com este método de início de sessão.",
    };

    public override IdentityError InvalidUserName(string? userName) => new()
    {
        Code = nameof(InvalidUserName),
        Description = $"O nome de utilizador '{userName}' é inválido, só pode conter letras ou números.",
    };

    public override IdentityError InvalidEmail(string? email) => new()
    {
        Code = nameof(InvalidEmail),
        Description = $"O email '{email}' é inválido.",
    };

    public override IdentityError DuplicateUserName(string userName) => new()
    {
        Code = nameof(DuplicateUserName),
        Description = $"O nome de utilizador '{userName}' já está a ser utilizado.",
    };

    public override IdentityError DuplicateEmail(string email) => new()
    {
        Code = nameof(DuplicateEmail),
        Description = $"O email '{email}' já está a ser utilizado.",
    };

    public override IdentityError InvalidRoleName(string? role) => new()
    {
        Code = nameof(InvalidRoleName),
        Description = $"O nome do perfil '{role}' é inválido.",
    };

    public override IdentityError DuplicateRoleName(string role) => new()
    {
        Code = nameof(DuplicateRoleName),
        Description = $"O nome do perfil '{role}' já está a ser utilizado.",
    };

    public override IdentityError UserAlreadyHasPassword() => new()
    {
        Code = nameof(UserAlreadyHasPassword),
        Description = "O utilizador já tem uma palavra-passe definida.",
    };

    public override IdentityError UserLockoutNotEnabled() => new()
    {
        Code = nameof(UserLockoutNotEnabled),
        Description = "O bloqueio de conta não está ativado para este utilizador.",
    };

    public override IdentityError UserAlreadyInRole(string role) => new()
    {
        Code = nameof(UserAlreadyInRole),
        Description = $"O utilizador já pertence ao perfil '{role}'.",
    };

    public override IdentityError UserNotInRole(string role) => new()
    {
        Code = nameof(UserNotInRole),
        Description = $"O utilizador não pertence ao perfil '{role}'.",
    };

    public override IdentityError PasswordTooShort(int length) => new()
    {
        Code = nameof(PasswordTooShort),
        Description = $"A palavra-passe deve ter, no mínimo, {length} caracteres.",
    };

    public override IdentityError PasswordRequiresUniqueChars(int uniqueChars) => new()
    {
        Code = nameof(PasswordRequiresUniqueChars),
        Description = $"A palavra-passe deve conter, no mínimo, {uniqueChars} caracteres diferentes.",
    };

    public override IdentityError PasswordRequiresNonAlphanumeric() => new()
    {
        Code = nameof(PasswordRequiresNonAlphanumeric),
        Description = "A palavra-passe deve conter, no mínimo, um caráter não alfanumérico.",
    };

    public override IdentityError PasswordRequiresDigit() => new()
    {
        Code = nameof(PasswordRequiresDigit),
        Description = "A palavra-passe deve conter, no mínimo, um número ('0'-'9').",
    };

    public override IdentityError PasswordRequiresLower() => new()
    {
        Code = nameof(PasswordRequiresLower),
        Description = "A palavra-passe deve conter, no mínimo, uma letra minúscula ('a'-'z').",
    };

    public override IdentityError PasswordRequiresUpper() => new()
    {
        Code = nameof(PasswordRequiresUpper),
        Description = "A palavra-passe deve conter, no mínimo, uma letra maiúscula ('A'-'Z').",
    };
}
