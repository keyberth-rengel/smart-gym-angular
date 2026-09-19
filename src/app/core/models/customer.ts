export interface Customer {
  email: string;
  name: string;
  age: number;
  booking_history: string[];
  payment_method: unknown | null;
}

export interface CustomerCreate {
  email: string;
  name: string;
  age: number;
}
