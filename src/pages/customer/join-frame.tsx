import type { ReactNode } from 'react';
import { Bone, LoadingRegion } from '@/components/common/skeleton';
import { JoinAside } from './join-aside';

/** The invitation and, beside it (under it on a phone), what joining means. */
export function JoinFrame({
  children,
  explains = true,
}: {
  children: ReactNode;
  explains?: boolean;
}) {
  if (!explains) {
    // A refusal says only what happened and the way out: what joining means is beside the point.
    return (
      <div className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-14 lg:pt-16">{children}</div>
    );
  }
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-8 px-4 pt-4 pb-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14 lg:px-8 lg:pt-10">
      <div>{children}</div>
      <JoinAside />
    </div>
  );
}

export function JoinSkeleton() {
  return (
    <LoadingRegion
      label="Cargando la invitación"
      className="flex flex-col gap-6 rounded-xl bg-card p-6 shadow-card lg:p-8"
    >
      <Bone className="size-12 rounded-lg" />
      <Bone className="h-10 w-4/5" />
      <Bone className="h-36 w-full rounded-lg" />
      <Bone className="h-14 w-full rounded-full" />
    </LoadingRegion>
  );
}
