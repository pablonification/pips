import { createFileRoute } from '@tanstack/react-router';
import { TestiProgrammeScreen } from '~/features/testi/TestiScreens';

export const Route = createFileRoute('/_app/_left-navbar/layanan/testi/$type/')(
  {
    component: TestiProgrammeScreen,
  },
);
