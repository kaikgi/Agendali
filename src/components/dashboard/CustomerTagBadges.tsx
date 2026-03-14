import { useAllCustomerTags } from '@/hooks/useClientTags';

interface CustomerTagBadgesProps {
  customerId: string | undefined;
  establishmentId: string | undefined;
  className?: string;
}

/**
 * Renders inline tag badges for a customer.
 * Uses the shared allCustomerTags query (cached, staleTime 30s).
 */
export function CustomerTagBadges({ customerId, establishmentId, className = '' }: CustomerTagBadgesProps) {
  const { data: allCustomerTags = [] } = useAllCustomerTags(establishmentId);

  if (!customerId) return null;

  const tags = allCustomerTags.filter((ct) => ct.customer_id === customerId);
  if (!tags.length) return null;

  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {tags.map((ct) => (
        <span
          key={ct.tag_id}
          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white leading-none"
          style={{ backgroundColor: ct.tag?.color || '#6b7280' }}
        >
          {ct.tag?.name}
        </span>
      ))}
    </span>
  );
}

/**
 * Standalone function version for use in components that already have the tags map.
 */
export function renderTagBadges(
  customerId: string,
  customerTagsMap: Map<string, Array<{ tag_id: string; tag: { name: string; color: string } | null }>>,
) {
  const tags = customerTagsMap.get(customerId);
  if (!tags?.length) return null;

  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((ct) => (
        <span
          key={ct.tag_id}
          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white leading-none"
          style={{ backgroundColor: ct.tag?.color || '#6b7280' }}
        >
          {ct.tag?.name}
        </span>
      ))}
    </span>
  );
}
