import type { FaqItem } from './faq-list';

/**
 * Questions of the home (docs/marketing/portada.md). Left out until the user decides: what the
 * plan costs a distributor. The answer about complaints names no Hornilla complaints book: it
 * does not exist yet.
 */
export const HOME_FAQ: readonly FaqItem[] = [
  {
    question: '¿Hornilla vende gas?',
    answer:
      'No. Hornilla muestra a las distribuidoras de tu zona. El gas, el precio, la entrega y la boleta son de la distribuidora que elijas.',
  },
  {
    question: '¿Quién pone los precios?',
    answer:
      'Cada distribuidora. El precio que ves es el que ella publicó; si tiene una promoción, verás su vigencia y condiciones.',
  },
  {
    question: '¿Puedo pedir desde Hornilla?',
    answer:
      'Pronto. Hoy puedes ver quién llega a tu puerta y llamar o escribir por WhatsApp a la distribuidora.',
  },
  {
    question: '¿Qué diferencia hay entre recarga y balón completo?',
    answer:
      'En la recarga entregas tu balón vacío y pagas solo el gas. El balón completo incluye el envase, para quien no tiene uno para cambiar.',
  },
  {
    question: '¿Para qué piden mi ubicación?',
    answer:
      'Solo para saber qué distribuidoras reparten hasta tu punto. Se queda en tu dispositivo; no la guardamos en tu cuenta.',
  },
  {
    question: 'Tuve un problema con un pedido, ¿a quién reclamo?',
    answer:
      'Primero a la distribuidora, que es quien te vendió. Si el problema es con Hornilla, escríbenos desde "Contacto y reclamos".',
  },
];
