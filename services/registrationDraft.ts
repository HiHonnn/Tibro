type RegistrationDraft = {
  email: string;
  username: string;
  password: string;
};

// Registration credentials only live in memory for the duration of the flow.
// They must never be serialized into Expo Router params or persisted to disk.
let currentDraft: RegistrationDraft | null = null;

export const saveRegistrationDraft = (draft: RegistrationDraft): void => {
  currentDraft = { ...draft };
};

export const getRegistrationDraft = (): RegistrationDraft | null => currentDraft;

export const clearRegistrationDraft = (): void => {
  currentDraft = null;
};
