export const environment = {
  production: true,
  apiBase: 'https://smart-gym-oop.onrender.com/api/v1',
  // Por ahora reutiliza la instancia de DESARROLLO de Clerk (pk_test_...); no hay una instancia
  // de producción separada todavía. Es pública, así que es seguro tenerla en el repo.
  clerkPublishableKey: 'pk_test_YnJhdmUtc2F3ZmlzaC00MzMwLmNsZXJrLmFjY291bnRzLmRldiQ',
};
