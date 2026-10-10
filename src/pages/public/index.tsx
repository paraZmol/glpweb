// Everything of the public area that is not the landing page: one chunk, loaded on demand.
import { LegalPage } from './legal';

export { NotFoundPage } from './not-found';
export { RegisterPage } from './register';
export { ResetPasswordPage } from './reset-password';
export { SignInPage } from './sign-in';

export const TermsPage = () => <LegalPage documentId="terms" />;
export const PrivacyPage = () => <LegalPage documentId="privacy" />;
export const CookiesPage = () => <LegalPage documentId="cookies" />;
