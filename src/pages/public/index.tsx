// Everything of the public area that is not the landing page: one chunk, loaded on demand.
import { LegalPage } from './legal';

export { ContactPage } from './contact';
export { DistributorPage } from './distributor';
export { NotFoundPage } from './not-found';
export { RegisterPage, SignInPage } from './sign-in';

export const TermsPage = () => <LegalPage documentId="terms" />;
export const PrivacyPage = () => <LegalPage documentId="privacy" />;
export const CookiesPage = () => <LegalPage documentId="cookies" />;
