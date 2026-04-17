'use client';

import { useRouter } from 'next/navigation';
import { NewProjectFlow } from '@/components/NewProjectFlow';

export default function NewProjectModal() {
  const router = useRouter();
  return <NewProjectFlow onClose={() => router.back()} />;
}
