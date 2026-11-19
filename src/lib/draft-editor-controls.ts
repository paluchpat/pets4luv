export function draftEditorControls(draftLabel: string) {
  return {
    PublishButton: {
      path: './components/admin/DraftEditorControls#DraftEditorPublishButton',
      clientProps: { draftLabel },
    },
    SaveDraftButton: './components/admin/DraftEditorControls#DraftEditorSaveDraftButton',
  }
}
