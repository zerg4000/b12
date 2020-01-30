//
//  QSCore.m
//  QSCore
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import "QSCore.h"
#import "QSNetworking.h"

static QSCore *core_shared_instance = nil;
static dispatch_once_t core_shared_instance_once_token;

NSUInteger const kQSCoreErrorCodeCancelled = 1u;


@interface QSCore()

@property (nonatomic, strong) QSNetworking *networking;

@end

@implementation QSCore

+ (instancetype)sharedInstance {
    return core_shared_instance;
}

+ (instancetype)createSharedInstanceUrl:(NSURL*)url {
    return [self createSharedInstanceUrl:url certificate:nil];
}

+ (instancetype)createSharedInstanceUrl:(NSURL*)url certificate:(NSURL*)certificate {
    dispatch_once(&core_shared_instance_once_token, ^{
        core_shared_instance = [[QSCore alloc] initWithServerUrl:url certificate:certificate];
    });

    return core_shared_instance;
}

- (instancetype)initWithServerUrl:(NSURL*)url {
    self = [self initWithServerUrl:url certificate:nil];
    return self;
}

- (instancetype)initWithServerUrl:(NSURL*)url certificate:(NSURL*)certificate {
    self = [super init];
    if(self) {
        self.networking = [[QSNetworking alloc] initWithServerUrl:url certificate:certificate];
    }
    return self;
}

- (void)setResponseDispatchQueue:(dispatch_queue_t)responseDispatchQueue
{
    self.networking.responseDispatchQueue = responseDispatchQueue;
}

- (dispatch_queue_t)responseDispatchQueue
{
    return self.networking.responseDispatchQueue;
}

- (void)performMethod:(QSMethod*)method {
    if(method == nil)
        return;
    
    id<QSCoreDelegate> delegate = self.delegate;
    
    if([delegate respondsToSelector:@selector(core:shouldPerformMethod:abortionError:)]) {
        NSError* error = [NSError coreErrorWithCode:kQSCoreErrorCodeCancelled message:@"Method execution was cancelled" error:nil];
        
        if(![delegate core:self shouldPerformMethod:method abortionError:&error]) {
            [method _completeWithResult:nil error:error];
            return;
        }
    }
    
    if([delegate respondsToSelector:@selector(core:willPerformMethod:)]) {
        [delegate core:self willPerformMethod:method];
    }
    
    [self.networking performMethod:method completion:^(NSError* error, id<QSSchema> schema) {
        if([delegate respondsToSelector:@selector(core:applyTransformationsForMethod:result:error:)])
            [delegate core:self applyTransformationsForMethod:method result:&schema error:&error];
        
        [method _completeWithResult:schema error:error];
        
        if([delegate respondsToSelector:@selector(core:didCompleteMethod:withResult:error:)])
            [delegate core:self didCompleteMethod:method withResult:schema error:error];
    }];
}

@end
