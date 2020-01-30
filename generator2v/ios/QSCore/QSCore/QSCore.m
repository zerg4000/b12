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
    [self.networking performMethod:method completion:^(NSError* error, id<QSSchema> schema) {
        if(method.completion != nil)
            method.completion(error, schema);
    }];
}

@end
