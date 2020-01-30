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

@protocol QSMethod <QSSchema>

@property (nonatomic, readonly) __unsafe_unretained Class responseSchemaClass;

- (QSSchema*)requestSchema;
- (Class)responseSchemaClass;
- (NSString*)name;
- (QSMethodCompletionBlock)completion;

@end

@interface QSMethod : QSSchema<QSMethod>

- (instancetype)initWithName:(NSString*)name
           forResponseSchema:(Class)cls
                  completion:(QSMethodCompletionBlock)completion;

@end
