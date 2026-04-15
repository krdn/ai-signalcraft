'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { SettingsSidebar, type SettingsSection } from './settings-sidebar';
import { ProviderKeys } from './provider-keys';
import { ModelSettings } from './model-settings';
import { ConcurrencySettings } from './concurrency-settings';
import { CollectionLimitsSettings } from './collection-limits-settings';
import { trpcClient } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function SectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case 'provider-keys':
      return <ProviderKeys />;
    case 'model-settings':
      return <ModelSettings />;
    case 'concurrency':
      return <ConcurrencySettings />;
    case 'collection-limits':
      return <CollectionLimitsSettings />;
  }
}

type Props = {
  trigger: React.ReactElement;
};

export function SettingsDialog({ trigger }: Props) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('provider-keys');

  const { data: providerKeysList } = useQuery({
    queryKey: [['settings', 'providerKeys', 'list']],
    queryFn: () => trpcClient.settings.providerKeys.list.query(),
  });

  const hasProviderKeys = (providerKeysList?.length ?? 0) > 0;

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="flex max-h-[85vh] w-[860px] max-w-[calc(100vw-2rem)] sm:max-w-[860px] flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            AI 설정
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <SettingsSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            hasProviderKeys={hasProviderKeys}
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <SectionContent section={activeSection} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
