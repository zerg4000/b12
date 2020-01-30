//
//  QSTransport.h
//  QSCore
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

@class QSTransport;

typedef void (^QSTransportAuthenticationCallback)(NSURLSessionAuthChallengeDisposition, NSURLCredential*);

@protocol QSTransportDelegate <NSObject>

// May be called in different thread
- (void)transport:(QSTransport*)transport didReceiveChallenge:(NSURLAuthenticationChallenge*)challenge
                                            completionHandler:(QSTransportAuthenticationCallback)callback;

@end

@interface QSTransportAttachment : NSObject

+ (instancetype)attachmentWithImage:(UIImage*)image named:(NSString*)name;
- (id)initWithImage:(UIImage*)image named:(NSString*)name;

@end

typedef void (^fetchDataCompletionBlock)(NSError*, NSData*);

@interface QSTransport : NSObject

@property (nonatomic, weak) id<QSTransportDelegate> delegate;

- (void)postData:(NSData*)data ofType:(NSString*)requestMimeType
           toURL:(NSURL*)url ofType:(NSString*)responseMimeType
  withCompletion:(fetchDataCompletionBlock)completion;

- (void)postData:(NSData*)data ofType:(NSString*)requestMimeType
           toURL:(NSURL*)url ofType:(NSString*)responseMimeType
  withCompletion:(fetchDataCompletionBlock)completion inDispatchQueue:(dispatch_queue_t)queue;

- (void)postAttachments:(NSArray*)attachments withParams:(NSDictionary*)paramsInfo
                  toURL:(NSURL*)url ofType:(NSString*)mimeType
         withCompletion:(fetchDataCompletionBlock)completion inDispatchQueue:(dispatch_queue_t)queue;

- (void)getDataOfType:(NSString*)requestMimeType fromURL:(NSURL*)url withCompletion:(fetchDataCompletionBlock)completion;

- (void)getDataOfType:(NSString*)requestMimeType fromURL:(NSURL*)url
       withCompletion:(fetchDataCompletionBlock)completion inDispatchQueue:(dispatch_queue_t)queue;

@end
