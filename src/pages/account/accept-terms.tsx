import { type FormEvent, useRef, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import {
  type ConsentField,
  LegalConsents,
  LegalVersionNote,
} from '@/components/account/legal-consents';
import { Highlight } from '@/components/brand/highlight';
import { Button } from '@/components/common/button';
import { AuthFrame } from '@/components/layout/auth-frame';
import { pendingLegalTexts } from '@/domain/legal/versions';
import type { UserProfile } from '@/domain/tenancy/types';
import { useAccount } from '@/features/account/account-context';
import { acceptLegalDocuments } from '@/features/auth/auth-actions';
import {
  type ConsentErrors,
  hasErrors,
  profileErrorsOf,
  validateConsents,
} from '@/features/auth/auth-forms';
import { usePageTitle } from '@/lib/page-title';
import { useAsyncAction } from '@/lib/use-async-action';
import { useFocusFirstInvalid } from '@/lib/use-focus-first-invalid';
import { useOnlineStatus } from '@/lib/use-online-status';
import { DiscardAccount } from './discard-account';

const OFFLINE_TEXT = 'Sin conexión: para registrar tu aceptación necesitas internet.';

// Plain-language reminders taken from docs/legal/terminos.md (§1, §4 and §5). They do not
// replace the document: the boxes below link to the full texts.
const KEY_POINTS = [
  'Hornilla conecta: cada pedido es un acuerdo directo entre tú y la distribuidora que eliges.',
  'Los precios y las promociones los publica cada distribuidora y son su responsabilidad.',
  'Pagas directamente a la distribuidora al recibir. Hornilla no cobra tus pedidos ni guarda tu dinero.',
  'Si una distribuidora no cumple un precio o una promoción, el reclamo se le hace a ella; Hornilla no responde por esa oferta. Esto no te quita los derechos que la ley te da como consumidor.',
];

const COPY = {
  /** First Google sign-in, or a registration that was cut before its profile was stored. */
  first: {
    title: 'Un paso antes de',
    highlighted: 'empezar.',
    lead: 'Tu cuenta ya existe. Para crear tu perfil necesitamos que leas y aceptes los términos y la política de privacidad de Hornilla.',
  },
  /** The account accepted an older version of the terms (and maybe of the privacy policy). */
  renewal: {
    title: 'Actualizamos',
    highlighted: 'los términos.',
    lead: 'Para seguir usando Hornilla necesitamos que revises y aceptes las versiones vigentes.',
  },
  /** Only the privacy policy is pending: an account from before the second box, or a new version. */
  privacyOnly: {
    title: 'Actualizamos la política de',
    highlighted: 'privacidad.',
    lead: 'Para seguir usando Hornilla necesitamos que la revises y autorices el uso de tus datos.',
  },
};

function copyFor(profile: UserProfile | null) {
  if (profile === null) return COPY.first;
  const pending = pendingLegalTexts(profile);
  return pending.privacy && !pending.terms ? COPY.privacyOnly : COPY.renewal;
}

/**
 * Pending step: the account has not accepted the current terms or privacy policy (PLAN 2.7,
 * 2.9). Nothing is recorded until the person ticks BOTH boxes and presses the button; then the
 * guard moves on. Whoever does not accept can delete the account right here.
 */
export function AcceptTermsPage() {
  usePageTitle('Aceptar los términos');
  const { session, profile, reloadProfile } = useAccount();
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const formRef = useRef<HTMLFormElement>(null);
  const [boxes, setBoxes] = useState({ acceptTerms: false, acceptPrivacy: false });
  const [isRecorded, setRecorded] = useState(false);
  const [errors, setErrors] = useState<ConsentErrors>({});
  useFocusFirstInvalid(formRef, errors);
  const copy = copyFor(profile);

  const tick = (field: ConsentField, checked: boolean) =>
    setBoxes((current) => ({ ...current, [field]: checked }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problems = validateConsents(boxes);
    setErrors(problems);
    if (hasErrors(problems) || !isOnline) return;
    void run(async () => {
      try {
        await acceptLegalDocuments(session.uid);
        setRecorded(true);
        reloadProfile();
      } catch (error) {
        setErrors({ form: profileErrorsOf(error).form });
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
          <DiscardAccount uid={session.uid} disabled={!isOnline || isRunning || isRecorded} />
        </div>
      }
    >
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-5">
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
