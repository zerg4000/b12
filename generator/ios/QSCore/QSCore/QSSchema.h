//
//  QSSchema.h
//  QSCore
//
//  Created by Gleb Lukianets on 15/04/15.
//  Copyright (c) 2015 QuantronSystems. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "JSONModel.h"

@protocol QSSchema <AbstractJSONModelProtocol>
@end

@interface QSSchema : JSONModel<QSSchema>
@end
