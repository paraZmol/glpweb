import { type FormEvent, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import {
  type ConsentField,
  LegalConsents,
  LegalVersionNote,
} from '@/components/account/legal-consents';
import { type ProfileDetails, ProfileDetailsFields } from '@/components/account/profile-details';
import { Highlight } from '@/components/brand/highlight';
import { Button } from '@/components/common/button';
import { TextLink } from '@/components/common/text-link';
import { AuthFrame } from '@/components/layout/auth-frame';
import { useAccount } from '@/features/account/account-context';
import { acceptLegalDocuments, suggestedProfileOf } from '@/features/auth/auth-actions';
import {
  type ConsentErrors,
  hasErrors,
  type ProfileErrors,
  validateConsents,
  validateProfile,
} from '@/features/auth/auth-forms';
import { usePageTitle } from '@/lib/page-title';
import { ROUTES } from '@/lib/routes';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';
import { acceptanceErrorsOf, copyFor, KEY_POINTS } from './accept-terms-copy';
import { DiscardAccount } from './discard-account';

const OFFLINE_TEXT = 'Sin conexión: para registrar tu aceptación necesitas internet.';

type Errors = ConsentErrors & ProfileErrors;

/**
 * Pending step: the account, with its e-mail verified, has not accepted the current terms or
 * privacy policy (PLAN 2.7, 2.9, 2.11). A new account also confirms its name and phone here:
 * the profile is created with the acceptance, never before. Nothing is recorded until the
 * person ticks BOTH boxes and presses the button; then the guard moves on.
 */
export function AcceptTermsPage() {
  usePageTitle('Aceptar los términos');
  const { session, profile, reloadProfile } = useAccount();
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [boxes, setBoxes] = useState({ acceptTerms: false, acceptPrivacy: false });
  const [details, setDetails] = useState<ProfileDetails>(() => {
    const suggested = suggestedProfileOf(session);
    return { displayName: suggested.displayName, phone: suggested.phone ?? '' };
  });
  const [isRecorded, setRecorded] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  useFocusFirstInvalid(formRef, errors);
  const copy = copyFor(profile);
  const isNewAccount = profile === null;

  const tick = (field: ConsentField, checked: boolean) =>
    setBoxes((current) => ({ ...current, [field]: checked }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems: Errors = {
      ...(isNewAccount ? validateProfile(details) : {}),
      ...validateConsents(boxes),
    };
    setErrors(problems);
    if (hasErrors(problems) || !isOnline) return;
    void run(async () => {
      try {
        await acceptLegalDocuments(session.uid, isNewAccount ? details : undefined);
        setRecorded(true);
        reloadProfile();
      } catch (error) {
        setErrors(acceptanceErrorsOf(error));
      }
    });
  };

  return (
    <AuthFrame
      title={
        <>
          {copy.title} <Highlight>{copy.highlighted}</Highlight>
        </>
      }
      lead={copy.lead}
      footer={
        <div className="flex flex-col gap-3 text-muted-foreground">
          <LegalVersionNote className="tabular-nums" />
          {isNewAccount ? (
            <DiscardAccount uid={session.uid} disabled={!isOnline || isRunning || isRecorded} />
          ) : (
            // An account with a profile has data: its deletion is asked for (privacy policy §7).
            <p>
              <TextLink to={ROUTES.contact}>No acepto: pedir que eliminen mi cuenta</TextLink>
            </p>
          )}
        </div>
      }
    >
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-5">
        {isNewAccount && (
          <ProfileDetailsFields
            details={details}
            errors={errors}
            onChange={(field, value) => setDetails((current) => ({ ...current, [field]: value }))}
          />
        )}
        <ul className="flex list-disc flex-col gap-2 rounded-lg bg-muted p-4 pl-9 text-[0.9375rem]">
          {KEY_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <LegalConsents {...boxes} onChange={tick} errors={errors} />
        <FormStatus error={errors.form} isOnline={isOnline} offlineText={OFFLINE_TEXT} />
        <Button
          type="submit"
          loading={isRunning || isRecorded}
          loadingLabel="Registrando tu aceptación…"
          disabled={!isOnline}
        >
          Aceptar y continuar
        </Button>
      </form>
    </AuthFrame>
  );
}
