import { notFound } from 'next/navigation';
import { PromotionWorkspace } from '@/components/students/promotion-workspace';

export default function PromotionPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <PromotionWorkspace />;
}