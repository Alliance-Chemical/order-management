import { useWorkspaceStore } from '@/lib/stores/workspace-store';

export function WorkspaceContent() {
  const { currentModule } = useWorkspaceStore();

  return (
    <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      Workspace module <strong>{currentModule}</strong> is not available in this build.
    </div>
  );
}
