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

extern NSUInteger const kQSCoreErrorCodeCancelled;

@class QSCore;

#pragma mark - QSCoreDelegate

@protocol QSCoreDelegate <NSObject>

@optional

- (BOOL)core:(QSCore*)core shouldPerformMethod:(QSMethod*)method abortionError:(NSError**)error;

- (void)core:(QSCore*)core willPerformMethod:(QSMethod*)method;

- (void)core:(QSCore*)core applyTransformationsForMethod:(QSMethod*)method result:(id<QSSchema>*)schema error:(NSError**)error;

- (void)core:(QSCore*)core didCompleteMethod:(QSMethod*)method withResult:(id<QSSchema>)result error:(NSError*)error;

@end

#pragma mark - QSCore

@interface QSCore : NSObject

@property (nonatomic, weak) id<QSCoreDelegate> delegate;

@property (nonatomic, retain) dispatch_queue_t responseDispatchQueue;

+ (instancetype)sharedInstance;

+ (instancetype)createSharedInstanceUrl:(NSURL*)url;
+ (instancetype)createSharedInstanceUrl:(NSURL*)url certificate:(NSURL*)certificate;

- (instancetype)initWithServerUrl:(NSURL*)url;
- (instancetype)initWithServerUrl:(NSURL*)url certificate:(NSURL*)certificate;

- (void)performMethod:(QSMethod*)method;

@end
