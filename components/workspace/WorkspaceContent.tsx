import { useWorkspaceStore } from '@/lib/stores/workspace-store';
import { OverviewModule } from '@/components/modules/OverviewModule';
import { PreMixModule } from '@/components/modules/PreMixModule';
import { PreShipModule } from '@/components/modules/PreShipModule';
import { DocumentsModule } from '@/components/modules/DocumentsModule';
import { ActivityModule } from '@/components/modules/ActivityModule';

export function WorkspaceContent() {
  const { currentModule } = useWorkspaceStore();

  const renderModule = () => {
    switch (currentModule) {
      case 'overview':
        return <OverviewModule />;
      case 'pre-mix':
        return <PreMixModule />;
      case 'pre-ship':
        return <PreShipModule />;
      case 'documents':
        return <DocumentsModule />;
      case 'activity':
        return <ActivityModule />;
      default:
        return <OverviewModule />;
    }
  };

  return (
    <div className="mt-6">
      {renderModule()}
    </div>
  );
}