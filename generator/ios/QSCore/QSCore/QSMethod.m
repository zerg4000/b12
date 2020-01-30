//
//  QSMethod.m
//  QSCore
//
//  Created by Gleb Lukianets on 15/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import "QSMethod.h"

@interface QSMethod()

@property (nonatomic, strong) NSString<Ignore>* methodName;
@property (nonatomic, strong) NSString<Ignore>* classString;
@property (nonatomic, strong) QSMethodCompletionBlock completionBlock;

@end

@implementation QSMethod

- (instancetype)initWithName:(NSString*)name
           forResponseSchema:(__unsafe_unretained Class)cls
                  completion:(QSMethodCompletionBlock)completion {

    self = [super init];
    if(self) {
        self.methodName = [name copy];
        self.classString = NSStringFromClass(cls);
        
        self.completionBlock = completion;
    }
    return self;
}

- (void)cancel {
    self.completionBlock = nil;
}

- (BOOL)isCancelled {
    return self.completionBlock == nil;
}

- (void)_completeWithResult:(id<QSSchema>)result error:(NSError *)error {
    if(self.completionBlock)
        self.completionBlock(error, result);
}

#pragma mark <QSMethod>

- (QSSchema*)qs_requestSchema {
    return self;
}

- (Class)qs_responseSchemaClass {
    return NSClassFromString(self.classString);
}

- (NSString*)qs_name {
    return self.methodName;
}

- (QSMethodCompletionBlock)qs_completion {
    return self.completionBlock;
}

@end
