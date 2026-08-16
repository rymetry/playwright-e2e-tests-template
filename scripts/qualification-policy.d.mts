export type QualificationPolicy = {
  checkId: string;
  project: string;
  mode: 'standard' | 'owner-approved';
  runCount: 1 | 3;
  ownerApprovalRef: string | undefined;
};

export function resolveQualificationPolicy(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): QualificationPolicy | undefined;
