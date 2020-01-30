//
//  QSCore.h
//  QSCore
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "QSMethod.h"
#import "NSError+QSCore.h"

@interface QSCore : NSObject

@property (nonatomic, retain) dispatch_queue_t responseDispatchQueue;

+ (instancetype)sharedInstance;

+ (instancetype)createSharedInstanceUrl:(NSURL*)url;
+ (instancetype)createSharedInstanceUrl:(NSURL*)url certificate:(NSURL*)certificate;

- (instancetype)initWithServerUrl:(NSURL*)url;
- (instancetype)initWithServerUrl:(NSURL*)url certificate:(NSURL*)certificate;

- (void)performMethod:(QSMethod*)method;

//  ...Maybe one day...
//- (void)setGlobalBlock;

@end
