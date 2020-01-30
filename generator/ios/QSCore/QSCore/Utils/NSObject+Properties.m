//
//  NSObject+Properties.m
//  QSCore
//
//  Created by Gleb Lukianets on 15/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import "NSObject+Properties.h"
#import <objc/runtime.h>

typedef NS_ENUM(NSUInteger, QSPropertyKind) {
    QSPropertyKindNone = 0,
    QSPropertyKindPrimitive,
    QSPropertyKindObject,
    QSPropertyKindId,
};

static const char *getPropertyType(objc_property_t property, QSPropertyKind* kind) {
    const char *attributes = property_getAttributes(property);
    printf("attributes=%s\n", attributes);
    char buffer[1 + strlen(attributes)];
    strcpy(buffer, attributes);
    char *state = buffer, *attribute;
    while ((attribute = strsep(&state, ",")) != NULL) {
        if (attribute[0] == 'T' && attribute[1] != '@') {
            // it's a C primitive type
            if(kind != NULL)
                *kind = QSPropertyKindPrimitive;
            const char* result = (const char *)[[NSData dataWithBytes:(attribute + 1) length:strlen(attribute) - 1] bytes];
            return result;
        }
        else if (attribute[0] == 'T' && attribute[1] == '@' && strlen(attribute) == 2) {
            // it's an ObjC id type:
            if(kind != NULL)
                *kind = QSPropertyKindId;
            return "";
        }
        else if (attribute[0] == 'T' && attribute[1] == '@') {
            // it's another ObjC object type:
            if(kind != NULL)
                *kind = QSPropertyKindObject;
            const char* result = (const char *)[[NSData dataWithBytes:(attribute + 3) length:strlen(attribute) - 4] bytes];
            return result;
        }
    }
    return NULL;
}

static objc_property_t getProperty(__unsafe_unretained Class cls, const char* propertyName) {
    if(propertyName == NULL)
        return NULL;

    return class_getProperty(cls, propertyName);
}

static NSArray *getPropertyAttributes(objc_property_t property) {
    if (property == NULL) {
        return nil;
    }

    NSString *propString = [NSString stringWithUTF8String:property_getAttributes(property)];
    NSArray *attrArray = [propString componentsSeparatedByString:@","];
    return attrArray;
}

static NSArray *propertyNames(__unsafe_unretained Class cls)
{
    unsigned count;
    objc_property_t *properties = class_copyPropertyList(cls, &count);

    NSMutableArray *rv = [NSMutableArray array];

    for (NSUInteger i = 0; i < count; i++)
    {
        objc_property_t property = properties[i];
        NSString *name = [NSString stringWithUTF8String:property_getName(property)];
        [rv addObject:name];
    }

    free(properties);

    return rv;
}

@implementation NSObject (Properties)

+ (NSArray*)attributeKeys {
    return propertyNames(self);
}

+ (__unsafe_unretained Class)classOfAttribute:(NSString*)attribute {
    if(attribute.length == 0)
        return nil;

//    objc_property_t property = getProperty(self, [attribute UTF8String]);

//    QSPropertyKind kind;
//    const char* getPropertyType()

    return nil;
}




@end
