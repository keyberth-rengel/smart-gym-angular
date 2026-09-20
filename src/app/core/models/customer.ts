/** Cliente tal como lo devuelve el backend (DTO: nunca datos de pago ni historial). */
export interface Customer {
  email: string;
  name: string;
  age: number;
}

export interface CustomerCreate {
  email: string;
  name: string;
  age: number;
  /** 8 dígitos; si viene, el backend lo vincula al correo del cliente. */
  dni?: string;
}
