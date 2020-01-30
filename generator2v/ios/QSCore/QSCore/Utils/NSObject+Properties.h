//
//  NSObject+Properties.h
//  QSCore
//
//  Created by Gleb Lukianets on 15/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface NSObject (Properties)

+ (NSArray*)attributeKeys;

+ (__unsafe_unretained Class)classOfAttribute:(NSString*)attribute;

@end
