export interface Trainer {
  email: string;
  name: string;
  age: number;
  specialty: string | null;
}

export interface TrainerCreate {
  email: string;
  name: string;
  age: number;
  specialty?: string;
}
