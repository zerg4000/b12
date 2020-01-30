//
//  QSNetworking.h
//  QSCore
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "QSSchema.h"
#import "QSMethod.h"

typedef void (^QSNetworkingCompletionBlock)(NSError*, id<QSSchema>);

@interface QSNetworking : NSObject

@property (nonatomic, retain) dispatch_queue_t responseDispatchQueue;

- (instancetype)initWithServerUrl:(NSURL*)url certificate:(NSURL*)certificate;

- (void)performMethod:(id<QSMethod>)method completion:(QSNetworkingCompletionBlock)completion;

@end
