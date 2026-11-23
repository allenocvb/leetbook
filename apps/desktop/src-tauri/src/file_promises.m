#import <AppKit/AppKit.h>
#import <objc/runtime.h>

// Extend Wry's existing destination, not the live view's class (AppKit/KVO owns it).
// Non-promise drags always follow Wry's original methods.
static const char enabledKey;
static void (*emitDrop)(const char *);
static NSString *stagingRoot;
static IMP originalEnter, originalUpdate, originalPrepare, originalPerform, originalExit;
static NSOperationQueue *promiseQueue;

static BOOL acceptsPromise(NSView *view, id<NSDraggingInfo> info) {
    return objc_getAssociatedObject(view, &enabledKey) != nil &&
        [info.draggingPasteboard availableTypeFromArray:NSFilePromiseReceiver.readableDraggedTypes] != nil;
}

static NSDictionary *pointFor(NSView *view, id<NSDraggingInfo> info) {
    NSPoint point = [view convertPoint:info.draggingLocation fromView:nil];
    return @{ @"x": @(point.x), @"y": @(view.isFlipped ? point.y : view.bounds.size.height - point.y), @"sequence": @(info.draggingSequenceNumber) };
}

static void sendEvent(NSString *type, NSDictionary *point, NSArray *paths, NSString *error) {
    NSMutableDictionary *event = [@{ @"type": type, @"position": point, @"paths": paths, @"transferId": point[@"sequence"] ?: @0 } mutableCopy];
    if (error) event[@"error"] = error;
    NSData *data = [NSJSONSerialization dataWithJSONObject:event options:0 error:nil];
    if (data && emitDrop) {
        NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        emitDrop(json.UTF8String);
    }
}

static NSDragOperation entered(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    if (!acceptsPromise(view, info)) return ((NSDragOperation (*)(id, SEL, id))originalEnter)(view, selector, info);
    sendEvent(@"enter", pointFor(view, info), @[], nil);
    return NSDragOperationCopy;
}
static NSDragOperation updated(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    if (!acceptsPromise(view, info)) return ((NSDragOperation (*)(id, SEL, id))originalUpdate)(view, selector, info);
    sendEvent(@"over", pointFor(view, info), @[], nil);
    return NSDragOperationCopy;
}
static BOOL prepare(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    if (acceptsPromise(view, info)) return YES;
    return ((BOOL (*)(id, SEL, id))originalPrepare)(view, selector, info);
}
static BOOL perform(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    if (!acceptsPromise(view, info)) return ((BOOL (*)(id, SEL, id))originalPerform)(view, selector, info);
    NSArray<NSFilePromiseReceiver *> *receivers = [info.draggingPasteboard readObjectsForClasses:@[NSFilePromiseReceiver.class] options:@{}];
    NSDictionary *point = pointFor(view, info);
    if (receivers.count == 0) {
        sendEvent(@"error", point, @[], @"The screenshot could not be received. Try taking it again.");
        return NO;
    }
    // A unique destination per drag prevents similarly named screenshots overwriting one another.
    NSString *directory = [stagingRoot stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
    NSError *error = nil;
    if (![NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:&error]) {
        sendEvent(@"error", point, @[], error.localizedDescription);
        return NO;
    }
    sendEvent(@"receiving", point, @[], nil);
    NSURL *destination = [NSURL fileURLWithPath:directory isDirectory:YES];
    dispatch_group_t group = dispatch_group_create();
    NSMutableArray *paths = [NSMutableArray array];
    NSMutableArray *errors = [NSMutableArray array];
    for (NSFilePromiseReceiver *receiver in receivers) {
        if (receiver.fileNames.count == 0) { [errors addObject:@"The screenshot has no promised filename."]; continue; }
        // The receiver calls its reader once per promised filename.
        for (NSUInteger i = 0; i < receiver.fileNames.count; i++) dispatch_group_enter(group);
        [receiver receivePromisedFilesAtDestination:destination options:@{} operationQueue:promiseQueue reader:^(NSURL *url, NSError *failure) {
            @synchronized(paths) {
                if (failure) [errors addObject:failure.localizedDescription];
                else if (url.isFileURL) [paths addObject:url.path];
            }
            dispatch_group_leave(group);
        }];
    }
    dispatch_group_notify(group, dispatch_get_main_queue(), ^{
        if (paths.count) sendEvent(@"drop", point, paths, nil);
        else sendEvent(@"error", point, @[], errors.firstObject ?: @"The screenshot could not be saved.");
    });
    return YES;
}
static void exited(NSView *view, SEL selector, id<NSDraggingInfo> info) {
    if (!acceptsPromise(view, info)) { ((void (*)(id, SEL, id))originalExit)(view, selector, info); return; }
    sendEvent(@"leave", pointFor(view, info), @[], nil);
}

static IMP replace(Class cls, SEL selector, IMP replacement) {
    Method method = class_getInstanceMethod(cls, selector);
    IMP original = method_getImplementation(method);
    class_replaceMethod(cls, selector, replacement, method_getTypeEncoding(method));
    return original;
}

void leetbook_install_file_promises(void *webview, const char *root, void (*callback)(const char *)) {
    NSView *view = (__bridge NSView *)webview;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        emitDrop = callback;
        stagingRoot = [NSString stringWithUTF8String:root];
        promiseQueue = [NSOperationQueue new];
        promiseQueue.maxConcurrentOperationCount = 2;
        // Wry defines these methods itself. Don't mutate an AppKit or KVO class.
        Class cls = NSClassFromString(@"WryWebView");
        if (!cls) return;
        originalEnter = replace(cls, @selector(draggingEntered:), (IMP)entered);
        originalUpdate = replace(cls, @selector(draggingUpdated:), (IMP)updated);
        originalPrepare = replace(cls, @selector(prepareForDragOperation:), (IMP)prepare);
        originalPerform = replace(cls, @selector(performDragOperation:), (IMP)perform);
        originalExit = replace(cls, @selector(draggingExited:), (IMP)exited);
    });
    objc_setAssociatedObject(view, &enabledKey, @YES, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    NSMutableArray *types = [view.registeredDraggedTypes mutableCopy];
    if (!types) types = [NSMutableArray array];
    [types addObjectsFromArray:NSFilePromiseReceiver.readableDraggedTypes];
    [view registerForDraggedTypes:types];
}
