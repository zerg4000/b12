//
//  NSError+QSCore.m
//  QSCore
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <Foundation/Foundation.h>
#include "NSError+QSCore.h"

static NSError* createError(NSInteger code, NSString* wrappedCode, NSString* message, NSError* error) {
    if(message == nil)
        message = @"";

    NSMutableDictionary *userInfo = [NSMutableDictionary dictionaryWithDictionary:@{kQSCoreErrorExtraCode : wrappedCode ?: @"",
                                                                                    kQSCoreErrorExtraMessage : message ?: @"",
                                                                                    }];

    if(error != nil)
        [userInfo setObject:error forKey:kQSCoreErrorExtraError];

    return [NSError errorWithDomain:kQSCoreErrorDomain code:code userInfo:userInfo];
}

@implementation NSError (QSCore)

+ (NSError*)coreErrorWithCode:(NSInteger)code message:(NSString*)message error:(NSError*)error {
    return createError(kQSCoreErrorCodeCommon, @(code).stringValue, message, error);
}

+ (NSError*)coreErrorWithComprehensiveCode:(NSString*)code message:(NSString*)message error:(NSError*)error {
    return createError(kQSCoreErrorCodeCommon, code, message, error);
}

+ (NSError*)coreErrorWithMessage:(NSString*)message error:(NSError*)error {
    return [NSError coreErrorWithCode:0 message:message error:error];
}

+ (NSError*)coreErrorWithMessage:(NSString*)message {
    return [NSError coreErrorWithCode:0 message:message error:nil];
}

+ (NSError*)serverErrorWithCode:(NSInteger)code message:(NSString*)message  error:(NSError*)error {
    return createError(kQSCoreErrorCodeServer, @(code).stringValue, message, error);
}

+ (NSError*)serverErrorWithComprehensiveCode:(NSString*)code message:(NSString*)message  error:(NSError*)error {
    return createError(kQSCoreErrorCodeServer, code, message, error);
}

+ (NSError*)serverErrorWithMessage:(NSString*)message error:(NSError*)error {
    return [NSError serverErrorWithCode:0 message:message error:error];
}

+ (NSError*)serverErrorWithMessage:(NSString*)message {
    return [NSError serverErrorWithCode:0 message:message error:nil];
}

- (BOOL)isServerStatusEqual:(NSString *)statusString {
    if (self.code == kQSCoreErrorCodeServer) {
        if ([[self.userInfo objectForKey:kQSCoreErrorExtraCode] isEqualToString:statusString]) {
            return YES;
        }
    }
    return NO;
}

@end
