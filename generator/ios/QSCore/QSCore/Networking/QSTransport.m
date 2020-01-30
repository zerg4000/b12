//
//  QSTransport.m
//  QSCore
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import "QSTransport.h"
#import "NSError+QSCore.h"

static NSTimeInterval const kQSTransportDefaultRequestTimeout = 30.f;
static NSTimeInterval const kQSTransportDefaultResourceTimeout = 100.f;

#pragma mark - QSTransportAttachment

@interface QSTransportAttachment() <NSURLConnectionDelegate>

@property (readonly, nonatomic) NSData *data;
@property (readonly, nonatomic) NSString *name;
@property (readonly, nonatomic) NSString *mimeType;

@end

@implementation QSTransportAttachment

+ (instancetype)attachmentWithImage:(UIImage*)image named:(NSString*)name
{
    return [[QSTransportAttachment alloc] initWithImage:image named:name];
}

- (id)initWithImage:(UIImage*)image named:(NSString*)name
{
    self = [super init];
    if(self)
    {
        _data = UIImagePNGRepresentation(image);
        _name = [name copy];
        _mimeType = @"image/png";
    }
    return self;
}

@end

#pragma mark - QSTransport

@interface QSTransport()<NSURLSessionDelegate>

@property (nonatomic) NSURLSessionConfiguration *sessionConfiguration;
@property (nonatomic) NSURLSession *session;

@end

@implementation QSTransport

- (instancetype)init {
    self = [super init];
    if(self) {
        self.sessionConfiguration = [NSURLSessionConfiguration defaultSessionConfiguration];
        [self.sessionConfiguration setTimeoutIntervalForRequest:kQSTransportDefaultRequestTimeout];
        [self.sessionConfiguration setTimeoutIntervalForResource:kQSTransportDefaultResourceTimeout];

        self.session = [NSURLSession sessionWithConfiguration:self.sessionConfiguration delegate:self delegateQueue:nil];
    }
    return self;
}

/*
    POST
*/

- (void)postData:(NSData*)data ofType:(NSString*)requestMimeType
           toURL:(NSURL*)url ofType:(NSString*)responseMimeType
  withCompletion:(fetchDataCompletionBlock)completion {
    [self postData:data ofType:requestMimeType toURL:url ofType:responseMimeType withCompletion:completion inDispatchQueue:nil];
}

- (void)postData:(NSData*)data ofType:(NSString*)requestMimeType
           toURL:(NSURL*)url ofType:(NSString*)responseMimeType
  withCompletion:(fetchDataCompletionBlock)completion inDispatchQueue:(dispatch_queue_t)queue {

    NSMutableURLRequest* request = [[NSMutableURLRequest alloc] initWithURL:url];
    [request setHTTPMethod:@"POST"];
    [request setHTTPBody:data];
    [request setValue:requestMimeType forHTTPHeaderField:@"Content-Type"];
    [request setValue:responseMimeType forHTTPHeaderField:@"Accept"];

    [[self.session uploadTaskWithRequest:request fromData:data completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if(error == nil)
            error = [self errorForResponse:response];

        dispatch_async(queue == nil ? dispatch_get_main_queue() : queue, ^{
            completion(error, data);
        });
    }] resume];
}

- (void)postAttachments:(NSArray*)attachments withParams:(NSDictionary*)paramsInfo
                  toURL:(NSURL*)url ofType:(NSString*)mimeType
         withCompletion:(fetchDataCompletionBlock)completion inDispatchQueue:(dispatch_queue_t)queue
{
    NSMutableURLRequest* request = [[NSMutableURLRequest alloc] initWithURL:url];

    [request setCachePolicy:NSURLRequestReloadIgnoringLocalCacheData];
    [request setHTTPShouldHandleCookies:NO];
    [request setHTTPMethod:@"POST"];

    NSString* boundary =  @"0xKhTmLbOuNdArYL0L";
    NSString* contentType = [NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary];

    [request setValue:contentType forHTTPHeaderField:@"Content-Type"];

    NSMutableData *body = [NSMutableData data];

    for(NSString* key in paramsInfo)
    {
        [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"%@\"\r\n\r\n", key] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[[NSString stringWithFormat:@"%@\r\n", paramsInfo[key]] dataUsingEncoding:NSUTF8StringEncoding]];
    }

    for(QSTransportAttachment* attachment in attachments)
    {
        [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"%@\"; filename=\"%@\"\r\n", attachment.name, attachment.name] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[[NSString stringWithFormat:@"Content-Type: %@\r\n\r\n", attachment.mimeType] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:attachment.data];
    }

    [body appendData:[[NSString stringWithFormat:@"\r\n--%@--\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];

    [request setHTTPBody:body];
    [request setValue:[NSString stringWithFormat:@"%tu", (unsigned long)body.length] forHTTPHeaderField:@"Content-Length"];

    [[self.session uploadTaskWithRequest:request fromData:body completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if(error == nil)
            error = [self errorForResponse:response];

        dispatch_async(queue == nil ? dispatch_get_main_queue() : queue, ^{
            completion(error, data);
        });
    }] resume];
}

/*
    GET
 */

- (void)getDataOfType:(NSString*)requestMimeType fromURL:(NSURL*)url withCompletion:(fetchDataCompletionBlock)completion {
    [self getDataOfType:requestMimeType fromURL:url withCompletion:completion inDispatchQueue:nil];
}

- (void)getDataOfType:(NSString*)requestMimeType fromURL:(NSURL*)url
  withCompletion:(fetchDataCompletionBlock)completion inDispatchQueue:(dispatch_queue_t)queue {

    NSMutableURLRequest* request = [[NSMutableURLRequest alloc] initWithURL:url];
    [request setHTTPMethod:@"GET"];
    [request setValue:requestMimeType forHTTPHeaderField:@"Accept"];

    [self.session dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if(error == nil)
            error = [self errorForResponse:response];

        dispatch_async(queue == nil ? dispatch_get_main_queue() : queue, ^{
            completion(error, data);
        });
    }];
}

- (NSError*)errorForResponse:(NSURLResponse*)response
{
    static const NSInteger kStatusCodeOk = 200;

    if([response isKindOfClass:[NSHTTPURLResponse class]]) {
        NSInteger statusCode = [(NSHTTPURLResponse*)response statusCode];
        if(statusCode != kStatusCodeOk)
            return [NSError coreErrorWithMessage:[NSString stringWithFormat:@"Server returned %zd: %@", statusCode, [NSHTTPURLResponse localizedStringForStatusCode:statusCode]]];
    }

    return nil;
}

#pragma mark NSURLSessionDelegate

- (void)URLSession:(NSURLSession *)session didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential *))completionHandler {
    id<QSTransportDelegate> delegate = self.delegate;
    if(delegate != nil) {
        [self.delegate transport:self didReceiveChallenge:challenge completionHandler:^(NSURLSessionAuthChallengeDisposition disposition, NSURLCredential *credential) {
            completionHandler(disposition, credential);
        }];
    } else {
        completionHandler(NSURLSessionAuthChallengePerformDefaultHandling, nil);
    }
}

@end
