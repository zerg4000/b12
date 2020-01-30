//
//  QSNetworking.m
//  QSCore
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import "QSNetworking.h"
#import "QSTransport.h"
#import "QSMethod.h"
#import "NSError+QSCore.h"

@import Security;

@interface QSNetworking()<QSTransportDelegate>

@property (nonatomic, strong) QSTransport *transport;
@property (nonatomic, strong) NSURL *url;
@property (nonatomic, strong) NSData *certData;

@end

@implementation QSNetworking

- (instancetype)initWithServerUrl:(NSURL*)url certificate:(NSURL*)certificate {
    self = [super init];
    if(self) {
        self.transport = [QSTransport new];
        self.transport.delegate = self;

        self.url = url;

        if(certificate != nil) {
            NSError *dataError;
            self.certData = [NSData dataWithContentsOfURL:certificate options:0 error:&dataError];
            if(dataError != nil)
                NSLog(@"Failed to obtain certificate data from url: %@ error: %@", certificate, dataError.description);
        }
        
        [JSONModel setGlobalKeyMapper:[[JSONKeyMapper alloc] initWithDictionary:@{ @"description" : @"desc",
                                                                                   }]];
    }
    return self;
}

- (BOOL)shouldTrustProtectionSpace:(NSURLProtectionSpace*)protectionSpace {
    if(self.certData != nil) {
        if([protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
            if(self.url != nil && [[protectionSpace.host lowercaseString] isEqualToString:[self.url.host lowercaseString]]) {
                CFDataRef certDataRef = (__bridge_retained CFDataRef)self.certData;
                SecCertificateRef certRef = SecCertificateCreateWithData(NULL, certDataRef);
                CFArrayRef certArrayRef = CFArrayCreate(NULL, (void *)&certRef, 1, NULL);
                SecTrustRef serverTrust = protectionSpace.serverTrust;
                SecTrustSetAnchorCertificates(serverTrust, certArrayRef);

                SecTrustResultType trustResult;
                SecTrustEvaluate(serverTrust, &trustResult);

                if(trustResult == kSecTrustResultRecoverableTrustFailure) {
                    CFDataRef errDataRef = SecTrustCopyExceptions(serverTrust);
                    SecTrustSetExceptions(serverTrust, errDataRef);

                    SecTrustEvaluate(serverTrust, &trustResult);

                    CFRelease(errDataRef);
                }

                CFRelease(certArrayRef);
                CFRelease(certRef);
                CFRelease(certDataRef);

                return trustResult == kSecTrustResultUnspecified || trustResult == kSecTrustResultProceed;
            }
        }
    }
    return NO;
}

- (void)performMethod:(id<QSMethod>)method completion:(QSNetworkingCompletionBlock)completion {
    static const QSNetworkingCompletionBlock noCompletion = ^(NSError *error, QSSchema *data) {};

    if(completion == nil)
        completion = noCompletion;

    NSError *error = nil;

    if(method == nil) {
        error = [NSError coreErrorWithMessage:@"Argument must not be nil"];
        completion(error, nil);
        return;
    }

    NSDictionary *dataDictionary = [method toDictionary];
    if(![NSJSONSerialization isValidJSONObject:dataDictionary]) {
        error = [NSError coreErrorWithMessage:@"Method is not valid JSON object"];
        completion(error, nil);
        return;
    }

    NSData *requestData = [NSJSONSerialization dataWithJSONObject:dataDictionary options:NSJSONWritingPrettyPrinted error:&error];
    if(error != nil) {
        completion(error, nil);
        return;
    }

    NSURL *url = [self.url URLByAppendingPathComponent:method.name];

    dispatch_queue_t dispatchQueue = self.responseDispatchQueue ?: nil;
    [self.transport postData:requestData ofType:@"application/json" toURL:url ofType:@"application/json" withCompletion:^(NSError *error, NSData *data)
    {
        if(error != nil) {
            completion([NSError coreErrorWithMessage:@"Transport returned error" error:error], nil);
            return;
        }

        NSObject *result = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
        if(error != nil) {
            completion([NSError coreErrorWithMessage:@"Failed to parse result" error:error], nil);
            return;
        }

        if(result == nil || ![result isKindOfClass:[NSDictionary class]]) {
            error = [NSError coreErrorWithMessage:@"Resulting JSON does not contain dictionary as root element"];
            completion(error, nil);
            return;
        }

        NSDictionary* responseResult = [self getResult:(NSDictionary*)result error:&error];
        if(error != nil) {
            completion(error, nil);
            return;
        }

        Class cls = [method responseSchemaClass];
        if(cls == nil) {
            completion([NSError coreErrorWithMessage:@"No class object found for schema"], nil);
            return;
        }

        QSSchema *schema = [[[method responseSchemaClass] alloc] initWithDictionary:responseResult error:&error];
        if(error != nil || schema == nil) {
            completion([NSError coreErrorWithMessage:@"Failed to parse response" error:error], nil);
            return;
        }

        completion(nil, schema);
    } inDispatchQueue:dispatchQueue];
}

- (NSDictionary*)getResult:(NSDictionary*)response error:(NSError**)error {
    NSDictionary* status = [response objectForKey:@"status"];

    NSString* errorCode = [status objectForKey:@"error"];

    if([errorCode isEqualToString:@"ok"]) {
        NSDictionary* result = [response objectForKey:@"result"];
        return result;
    }

    NSString* message = [status objectForKey:@"errorMessage"];
    if(error != nil)
        *error = [NSError serverErrorWithCode:[errorCode integerValue] message:message error:nil];

    return nil;
}

#pragma mark QSTransportDelegate

- (void)transport:(QSTransport *)transport didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge completionHandler:(QSTransportAuthenticationCallback)callback {
    if([self shouldTrustProtectionSpace:challenge.protectionSpace]) {
        NSURLCredential *credential = [NSURLCredential credentialForTrust:challenge.protectionSpace.serverTrust];
        callback(NSURLSessionAuthChallengeUseCredential, credential);
    } else {
        callback(NSURLSessionAuthChallengePerformDefaultHandling, nil);
    }
}

@end
