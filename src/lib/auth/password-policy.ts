export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRequirementId = "minLength" | "hasLetter" | "hasDigit";

export type PasswordRequirement = {
  id: PasswordRequirementId;
  label: string;
  test: (password: string) => boolean;
};

const LETTER_RE = /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
const DIGIT_RE = /\d/;

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "minLength",
    label: `Co najmniej ${PASSWORD_MIN_LENGTH} znaków`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "hasLetter",
    label: "Przynajmniej jedna litera",
    test: (password) => LETTER_RE.test(password),
  },
  {
    id: "hasDigit",
    label: "Przynajmniej jedna cyfra",
    test: (password) => DIGIT_RE.test(password),
  },
];

export type EvaluatedPasswordRequirement = PasswordRequirement & { met: boolean };

export function evaluatePasswordRequirements(
  password: string
): EvaluatedPasswordRequirement[] {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));
}

/** Komunikat błędu do wyświetlenia użytkownikowi lub zwrócenia z akcji serwerowej. */
export function passwordValidationError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`;
  }
  if (!LETTER_RE.test(password)) {
    return "Hasło musi zawierać przynajmniej jedną literę.";
  }
  if (!DIGIT_RE.test(password)) {
    return "Hasło musi zawierać przynajmniej jedną cyfrę.";
  }
  return null;
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}

export function confirmPasswordError(password: string, confirm: string): string | null {
  if (!confirm) return null;
  if (password !== confirm) return "Hasła nie są identyczne.";
  return null;
}

export function validateNewPasswordPair(
  password: string,
  confirm: string
): string | null {
  const policyError = passwordValidationError(password);
  if (policyError) return policyError;
  return confirmPasswordError(password, confirm);
}
