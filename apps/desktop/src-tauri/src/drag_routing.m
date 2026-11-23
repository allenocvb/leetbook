#import <AppKit/AppKit.h>
#import <objc/runtime.h>

/*
 * Decides which drags Tauri handles and which go to the web page.
 *
 * Tauri's macOS drop handler (Wry) claims every drag that enters the window and only ever
 * reports file paths. Two kinds of drag were lost to that:
 *   - drags that start inside the app (a notes image, a library row), which never produced
 *     HTML5 dragover/drop events, so they snapped back to where they started;
 *   - drags that carry no path yet, like the Cmd-Shift-4 floating thumbnail, which offers a
 *     file *promise*. Wry saw no paths and the drop went nowhere.
 * WebKit handles both itself — it fulfils file promises and hands the page real File objects,
 * as Safari does — so only plain Finder file drags stay with Tauri, which needs their paths
 * (folders included) for the Files library.
 */
static IMP wryEnter, wryUpdate, wryPerform, wryExit;
static IMP webkitEnter, webkitUpdate, webkitPerform, webkitExit;

static BOOL forTauri(id<NSDraggingInfo> info) {
    if (info.draggingSource != nil) return NO;  // started inside this app
    NSPasteboard *board = info.draggingPasteboard;
    return [board availableTypeFromArray:@[ NSPasteboardTypeFileURL ]] != nil &&
        [board canReadObjectForClasses:@[ NSURL.class ]
                               options:@{ NSPasteboardURLReadingFileURLsOnlyKey: @YES }];
}

static NSDragOperation entered(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    IMP target = forTauri(info) ? wryEnter : webkitEnter;
    return ((NSDragOperation (*)(id, SEL, id))target)(view, selector, info);
}

static NSDragOperation updated(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    IMP target = forTauri(info) ? wryUpdate : webkitUpdate;
    return ((NSDragOperation (*)(id, SEL, id))target)(view, selector, info);
}

static BOOL perform(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    IMP target = forTauri(info) ? wryPerform : webkitPerform;
    return ((BOOL (*)(id, SEL, id))target)(view, selector, info);
}

static void exited(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    IMP target = forTauri(info) ? wryExit : webkitExit;
    ((void (*)(id, SEL, id))target)(view, selector, info);
}

static IMP replace(Class cls, SEL selector, IMP replacement) {
    Method method = class_getInstanceMethod(cls, selector);
    IMP original = method_getImplementation(method);
    class_replaceMethod(cls, selector, replacement, method_getTypeEncoding(method));
    return original;
}

/// Returns 1 when installed, 0 when Wry's view class could not be found.
int leetbook_install_drag_routing(void) {
    static int installed = 0;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        // Patch Wry's subclass only; WKWebView itself stays untouched.
        Class wry = NSClassFromString(@"WryWebView");
        if (!wry) return;
        Class webkit = class_getSuperclass(wry);
        webkitEnter = class_getMethodImplementation(webkit, @selector(draggingEntered:));
        webkitUpdate = class_getMethodImplementation(webkit, @selector(draggingUpdated:));
        webkitPerform = class_getMethodImplementation(webkit, @selector(performDragOperation:));
        webkitExit = class_getMethodImplementation(webkit, @selector(draggingExited:));
        wryEnter = replace(wry, @selector(draggingEntered:), (IMP)entered);
        wryUpdate = replace(wry, @selector(draggingUpdated:), (IMP)updated);
        wryPerform = replace(wry, @selector(performDragOperation:), (IMP)perform);
        wryExit = replace(wry, @selector(draggingExited:), (IMP)exited);
        installed = 1;
    });
    return installed;
}
