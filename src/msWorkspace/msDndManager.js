const { GLib } = imports.gi;

/* exported MsDndManager */
var MsDndManager = class MsDndManager {
    constructor(msWindowManager) {
        this.msWindowManager = msWindowManager;
        this.signalMap = new Map();
        this.msWindowManager.connect('ms-window-created', () => {
            log('ms-window-created');
            this.listenForMsWindowsDragSignal();
        });
        this.listenForMsWindowsDragSignal();
        this.workspaceSignal = global.workspace_manager.connect(
            'active-workspace-changed',
            () => {
                if (this.dragInProgress) {
                    const newMsWorkspace = global.msWorkspaceManager.getActiveMsWorkspace();
                    log(
                        'SET WINDOW TO WORKSPACE',
                        global.msWorkspaceManager.primaryMsWorkspaces.indexOf(
                            newMsWorkspace
                        )
                    );
                    global.msWorkspaceManager.setWindowToMsWorkspace(
                        this.msWindowDragged,
                        newMsWorkspace
                    );
                    if (this.msWindowDragged.isDialog) {
                        this.originalParent = newMsWorkspace.floatableContainer;
                    } else {
                        this.originalParent = newMsWorkspace.tileableContainer;
                    }
                }
            }
        );
    }

    listenForMsWindowsDragSignal() {
        this.msWindowManager.msWindowList.forEach(msWindow => {
            if (!this.signalMap.has(msWindow)) {
                const id = msWindow.connect('dragged-changed', (_, dragged) => {
                    log('Dragged-changed');
                    if (dragged) {
                        this.startDrag(msWindow);
                    } else {
                        this.endDrag();
                    }
                });
                this.signalMap.set(msWindow, id);
            }
        });
    }

    startDrag(msWindow) {
        this.dragInProgress = true;
        this.msWindowDragged = msWindow;
        this.originalParent = msWindow.get_parent();
        global.msWorkspaceManager.msWorkspaceContainer.setActorAbove(msWindow);
        this.checkUnderThePointerRoutine();
    }

    endDrag() {
        log('end drag');
        this.msWindowDragged.get_parent().remove_child(this.msWindowDragged);
        this.originalParent.add_child(this.msWindowDragged);
        this.dragInProgress = false;
        delete this.originalParent;
        this.msWindowDragged.msWorkspace.tilingLayout.onTile();
        delete this.msWindowDragged;
    }

    checkUnderThePointerRoutine() {
        if (!this.dragInProgress) return;
        let [x, y] = global.get_pointer();
        //Check for all tileable of the msWindow's msWorkspace if the pointer is above another msWindow
        const msWorkspace = this.msWindowDragged.msWorkspace;
        msWorkspace.tileableList
            .filter(
                tileable =>
                    tileable.visible &&
                    tileable.get_parent() === msWorkspace.tileableContainer
            )
            .forEach(tileable => {
                if (
                    x >= tileable.x &&
                    x <= tileable.x + tileable.width &&
                    y >= tileable.y &&
                    y <= tileable.y + tileable.height
                ) {
                    msWorkspace.swapTileable(this.msWindowDragged, tileable);
                }
            });
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this.checkUnderThePointerRoutine();
            return GLib.SOURCE_REMOVE;
        });
    }
};
