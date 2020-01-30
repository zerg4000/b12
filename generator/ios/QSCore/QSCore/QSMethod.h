//
//  QSMethod.h
//  QSCore
//
//  Created by Gleb Lukianets on 15/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "QSSchema.h"

typedef void (^QSMethodCompletionBlock)(NSError*, id<QSSchema>);

@protocol QSMethod

@property (nonatomic, readonly) QSSchema *qs_requestSchema;
@property (nonatomic, readonly) Class qs_responseSchemaClass;
@property (nonatomic, readonly) NSString *qs_name;
@property (nonatomic, readonly) QSMethodCompletionBlock qs_completion;

@end

@interface QSMethod : QSSchema<QSMethod>

@property (readonly) BOOL isCancelled;

- (instancetype)initWithName:(NSString*)name
           forResponseSchema:(Class)cls
                  completion:(QSMethodCompletionBlock)completion;

- (void)cancel;

- (void)_completeWithResult:(id<QSSchema>)result error:(NSError*)error;

@end
