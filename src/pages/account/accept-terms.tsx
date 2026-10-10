import { type FormEvent, useState } from 'react';
import { FormStatus } from '@/components/account/form-parts';
import { TermsConsent } from '@/components/account/terms-consent';
import { Highlight } from '@/components/brand/highlight';
import { Button } from '@/components/common/button';
import { AuthFrame } from '@/components/layout/auth-frame';
import { TERMS_VERSION } from '@/domain/legal/versions';
import { useAccount } from '@/features/account/account-context';
import { acceptCurrentTerms } from '@/features/auth/auth-actions';
import { profileErrorsOf } from '@/features/auth/auth-forms';
import { usePageTitle } from '@/lib/page-title';
import { useAsyncAction } from '@/lib/use-async-action';
import { useOnlineStatus } from '@/lib/use-online-status';

const OFFLINE_TEXT = 'Sin conexión: para registrar tu aceptación necesitas internet.';
const MISSING_CONSENT = 'Marca la casilla para aceptar los términos y continuar.';

// Plain-language reminders taken from docs/legal/terminos.md (§1, §4 and §5). They do not
// replace the document: the box below links to the full text.
const KEY_POINTS = [
  'Hornilla conecta: cada pedido es un acuerdo directo entre tú y la distribuidora que eliges.',
  'Los precios y las promociones los publica cada distribuidora y son su responsabilidad.',
  'Pagas directamente a la distribuidora al recibir. Hornilla no cobra ni guarda tu dinero.',
];

const COPY = {
  /** First Google sign-in, or a registration that was cut before its profile was stored. */
  first: {
    title: 'Un paso antes de',
    highlighted: 'empezar.',
    lead: 'Tu cuenta ya existe. Para crear tu perfil necesitamos que leas y aceptes los términos de Hornilla.',
  },
  /** The account accepted an older version. */
  renewal: {
    title: 'Actualizamos',
    highlighted: 'los términos.',
    lead: 'Para seguir usando Hornilla necesitamos que revises y aceptes la versión vigente.',
  },
};

/**
 * Pending step: the account has no acceptance of the current terms (PLAN 2.7). Nothing is
 * recorded until the person ticks the box AND presses the button; then the guard moves on.
 */
export function AcceptTermsPage() {
  usePageTitle('Aceptar los términos');
  const { session, profile, reloadProfile } = useAccount();
  const isOnline = useOnlineStatus();
  const { isRunning, run } = useAsyncAction();
  const [isAccepted, setAccepted] = useState(false);
  const [isRecorded, setRecorded] = useState(false);
  const [errors, setErrors] = useState<{ acceptTerms?: string; form?: string }>({});
  const copy = profile === null ? COPY.first : COPY.renewal;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setErrors(isAccepted ? {} : { acceptTerms: MISSING_CONSENT });
    if (!isAccepted || !isOnline) return;
    void run(async () => {
      try {
        await acceptCurrentTerms(session.uid);
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
        <p className="text-muted-foreground tabular-nums">
          Versión {TERMS_VERSION} de los términos. Si prefieres no aceptar, puedes cerrar sesión
          arriba.
        </p>
      }
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <ul className="flex list-disc flex-col gap-2 rounded-lg bg-muted p-4 pl-9 text-[0.9375rem]">
          {KEY_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <TermsConsent checked={isAccepted} onChange={setAccepted} error={errors.acceptTerms} />
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
