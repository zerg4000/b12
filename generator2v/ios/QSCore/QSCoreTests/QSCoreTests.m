//
//  QSCoreTests.m
//  QSCoreTests
//
//  Created by Gleb Lukianets on 14/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <UIKit/UIKit.h>
#import <XCTest/XCTest.h>

#import "QSCore.h"
#import "QSSchema.h"
#import "QSMethod.h"

static NSString* const kQSCoreDefaultServerURL = @"http://evrasia-qa.quantron-systems.com:19201";

@protocol QSProductSchema
@end
@interface QSProductSchema : QSSchema<QSProductSchema>
@end
@implementation QSProductSchema
@end

@interface QSGetProductsByParentSchema : QSSchema
@property (nonatomic, strong) NSArray<QSProductSchema> *products;
@end
@implementation QSGetProductsByParentSchema
@end

typedef void (^QSGetProductsByParentCompletionBlock)(NSError*, QSGetProductsByParentSchema*);

@interface QSGetProductsByParent : QSMethod

@property (nonatomic, strong) NSString *parentCategoryId;

@end

@implementation QSGetProductsByParent

+ (instancetype)methodWithParentCategoryId:(NSString*)string completion:(QSGetProductsByParentCompletionBlock)completion {
    QSGetProductsByParent* instance = [[self alloc] initWithCompletion:completion];
    instance.parentCategoryId = string;
    return instance;
}

- (instancetype)initWithCompletion:(QSGetProductsByParentCompletionBlock)completion {
    self = [super initWithName:@"getProductsByParent" forResponseSchema:[QSGetProductsByParentSchema class] completion:^(NSError *error, id<QSSchema> schema) {
        completion(error, (QSGetProductsByParentSchema*)schema);
    }];
    if(self) {
        //...
    }
    return self;
}

@end

@interface QSCoreTests : XCTestCase

@property (nonatomic, strong) QSCore *core;

@end

@implementation QSCoreTests

- (void)setUp {
    [super setUp];
    self.core = [QSCore createSharedInstanceUrl:[NSURL URLWithString:kQSCoreDefaultServerURL]];
}

- (void)tearDown {
    [super tearDown];
}

- (void)testExample {

    XCTestExpectation *expectation = [self expectationWithDescription:@"MethodDone"];


        /*
        if(error == nil && result != nil)
            XCTAssert(YES, @"Pass");
        else
            XCTAssert(NO, @"Error");

         */
}

- (void)testPerformanceExample {
    // This is an example of a performance test case.
    [self measureBlock:^{
        // Put the code you want to measure the time of here.
    }];
}

@end
