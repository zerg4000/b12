//
//  NSError+QSCore.h
//  QSCore
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <Foundation/Foundation.h>

static NSString* const kQSCoreErrorDomain = @"com.quantron-systems.QSCore";
static NSString* const kQSCoreErrorExtraCode = @"com.quantron-systems.QSCoreErrorCode";
static NSString* const kQSCoreErrorExtraMessage = @"com.quantron-systems.QSCoreErrorMessage";
static NSString* const kQSCoreErrorExtraError = @"com.quantron-systems.QSCoreErrorError";

static NSInteger const kQSCoreErrorCodeServer = 0;
static NSInteger const kQSCoreErrorCodeCommon = 1;

@interface NSError (QSCore)

+ (NSError*)coreErrorWithCode:(NSInteger)code message:(NSString*)message error:(NSError*)error;

+ (NSError*)coreErrorWithMessage:(NSString*)message error:(NSError*)error;

+ (NSError*)coreErrorWithMessage:(NSString*)message;

+ (NSError*)serverErrorWithCode:(NSInteger)code message:(NSString*)message error:(NSError*)error;

+ (NSError*)serverErrorWithMessage:(NSString*)message error:(NSError*)error;

+ (NSError*)serverErrorWithMessage:(NSString*)message;

@end
